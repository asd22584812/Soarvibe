/**
 * City Shares client image pipeline — orient, resize, WebP compress.
 * Target: long edge 1600–1920, quality ~0.82, ~300KB–1MB, hard max 2MB.
 * HEIC: try native decode; on failure return structured error for UX fallback.
 */
(function (global) {
  'use strict';

  var MAX_PER_POST = 3;
  var MAX_BYTES = 2 * 1024 * 1024;
  var TARGET_MIN = 300 * 1024;
  var TARGET_MAX = 1024 * 1024;
  var LONG_EDGE_MIN = 1600;
  var LONG_EDGE_MAX = 1920;
  var WEBP_QUALITY = 0.82;

  function newImageId() {
    try {
      if (global.crypto && typeof global.crypto.randomUUID === 'function') {
        return global.crypto.randomUUID().replace(/-/g, '');
      }
    } catch (e) {
      /* fall through */
    }
    return (
      'img' +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function isHeicFile(file) {
    if (!file) return false;
    var type = String(file.type || '').toLowerCase();
    var name = String(file.name || '').toLowerCase();
    if (type === 'image/heic' || type === 'image/heif') return true;
    if (/\.heic$|\.heif$/i.test(name)) return true;
    return false;
  }

  function isAcceptedInput(file) {
    if (!file) return false;
    if (isHeicFile(file)) return true;
    var type = String(file.type || '').toLowerCase();
    if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(type)) return true;
    var name = String(file.name || '').toLowerCase();
    return /\.(jpe?g|png|webp|gif)$/i.test(name);
  }

  function loadBitmap(file) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(file)
        .then(function (bmp) {
          return { bitmap: bmp, width: bmp.width, height: bmp.height };
        })
        .catch(function () {
          return loadViaImageElement(file);
        });
    }
    return loadViaImageElement(file);
  }

  function loadViaImageElement(file) {
    return new Promise(function (resolve, reject) {
      var url = '';
      try {
        url = URL.createObjectURL(file);
      } catch (e) {
        reject(e);
        return;
      }
      var img = new Image();
      img.onload = function () {
        try {
          URL.revokeObjectURL(url);
        } catch (e2) {
          /* silent */
        }
        resolve({ image: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
      };
      img.onerror = function () {
        try {
          URL.revokeObjectURL(url);
        } catch (e3) {
          /* silent */
        }
        reject(new Error('decode_failed'));
      };
      img.src = url;
    });
  }

  function computeTargetSize(w, h) {
    var longEdge = Math.max(w, h);
    if (longEdge <= 0) return { width: w, height: h };
    var targetLong = longEdge;
    if (longEdge > LONG_EDGE_MAX) targetLong = LONG_EDGE_MAX;
    else if (longEdge >= LONG_EDGE_MIN) targetLong = longEdge;
    // below 1600: keep native (do not upscale)
    var scale = targetLong / longEdge;
    return {
      width: Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale))
    };
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(
          function (blob) {
            if (!blob) reject(new Error('toBlob_failed'));
            else resolve(blob);
          },
          type,
          quality
        );
        return;
      }
      try {
        var dataUrl = canvas.toDataURL(type, quality);
        var bin = atob(dataUrl.split(',')[1] || '');
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: type }));
      } catch (e) {
        reject(e);
      }
    });
  }

  function drawToCanvas(source, width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');
    ctx.drawImage(source.bitmap || source.image, 0, 0, width, height);
    if (source.bitmap && typeof source.bitmap.close === 'function') {
      try {
        source.bitmap.close();
      } catch (e) {
        /* silent */
      }
    }
    return canvas;
  }

  /**
   * Compress a picked File into WebP Blob ready for R2 upload.
   * @returns {Promise<{ ok: true, blob, file, imageId, width, height, bytes } | { ok: false, code, message }>}
   */
  function compressForUpload(file) {
    if (!file) {
      return Promise.resolve({
        ok: false,
        code: 'no_file',
        message: '未選擇檔案'
      });
    }
    if (!isAcceptedInput(file)) {
      return Promise.resolve({
        ok: false,
        code: 'unsupported_type',
        message: '請選擇 JPG、PNG、WebP 或 iPhone 照片'
      });
    }

    var heic = isHeicFile(file);

    return loadBitmap(file)
      .catch(function () {
        if (heic) {
          return Promise.reject({
            code: 'heic_unsupported',
            message:
              '這張照片格式目前無法處理，請改選 JPG / PNG，或使用 iPhone「最相容」照片格式。'
          });
        }
        return Promise.reject({
          code: 'decode_failed',
          message: '無法讀取這張照片，請改選其他檔案'
        });
      })
      .then(function (source) {
        var size = computeTargetSize(source.width, source.height);
        var canvas = drawToCanvas(source, size.width, size.height);
        var qualities = [WEBP_QUALITY, 0.75, 0.68, 0.6, 0.52];
        var attempt = 0;

        function encodeAt(q) {
          return canvasToBlob(canvas, 'image/webp', q).then(function (blob) {
            if (!blob) {
              return { ok: false, code: 'encode_failed', message: 'WebP 編碼失敗' };
            }
            if (blob.size > MAX_BYTES) {
              if (attempt < qualities.length - 1) {
                attempt += 1;
                return encodeAt(qualities[attempt]);
              }
              // Last resort: shrink long edge further
              if (size.width > 800 || size.height > 800) {
                var nw = Math.max(1, Math.round(size.width * 0.75));
                var nh = Math.max(1, Math.round(size.height * 0.75));
                var smaller = document.createElement('canvas');
                smaller.width = nw;
                smaller.height = nh;
                var sctx = smaller.getContext('2d');
                if (!sctx) {
                  return {
                    ok: false,
                    code: 'too_large',
                    message: '壓縮後仍超過 2MB，請換一張較小的照片'
                  };
                }
                sctx.drawImage(canvas, 0, 0, nw, nh);
                canvas = smaller;
                size = { width: nw, height: nh };
                attempt = 0;
                return encodeAt(qualities[0]);
              }
              return {
                ok: false,
                code: 'too_large',
                message: '壓縮後仍超過 2MB，請換一張較小的照片'
              };
            }
            // Optional: if tiny and quality high enough, accept (no need to inflate)
            var imageId = newImageId();
            var outFile = new File([blob], imageId + '.webp', {
              type: 'image/webp',
              lastModified: Date.now()
            });
            return {
              ok: true,
              blob: blob,
              file: outFile,
              imageId: imageId,
              width: size.width,
              height: size.height,
              bytes: blob.size,
              quality: q,
              heicSource: heic
            };
          });
        }

        return encodeAt(qualities[0]);
      })
      .catch(function (err) {
        if (err && err.code) {
          return { ok: false, code: err.code, message: err.message };
        }
        if (heic) {
          return {
            ok: false,
            code: 'heic_unsupported',
            message:
              '這張照片格式目前無法處理，請改選 JPG / PNG，或使用 iPhone「最相容」照片格式。'
          };
        }
        return {
          ok: false,
          code: 'compress_failed',
          message: (err && err.message) || '照片處理失敗'
        };
      });
  }

  global.SOARVIBE_CITY_SHARES_IMAGE = {
    MAX_PER_POST: MAX_PER_POST,
    MAX_BYTES: MAX_BYTES,
    TARGET_MIN: TARGET_MIN,
    TARGET_MAX: TARGET_MAX,
    LONG_EDGE_MIN: LONG_EDGE_MIN,
    LONG_EDGE_MAX: LONG_EDGE_MAX,
    WEBP_QUALITY: WEBP_QUALITY,
    newImageId: newImageId,
    isHeicFile: isHeicFile,
    isAcceptedInput: isAcceptedInput,
    compressForUpload: compressForUpload,
    computeTargetSize: computeTargetSize
  };
})(typeof window !== 'undefined' ? window : globalThis);
