import { createRequire as __createRequire } from 'node:module';
const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "../node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
      kListener: Symbol("kListener"),
      kStatusCode: Symbol("status-code"),
      kWebSocket: Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// ../node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "../node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { websocketMask, websocketUnmask } = __require("http");
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (websocketMask) {
      module.exports.mask = function(source, mask, output, offset, length) {
        if (length < 24) _mask(source, mask, output, offset, length);
        else websocketMask(source, mask, output, offset, length);
      };
      module.exports.unmask = function(buffer, mask) {
        if (buffer.length < 24) _unmask(buffer, mask);
        else websocketUnmask(buffer, mask);
      };
    } else if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// ../node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "../node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = Symbol("kDone");
    var kRun = Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// ../node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "../node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = Symbol("permessage-deflate");
    var kTotalLength = Symbol("total-length");
    var kCallback = Symbol("callback");
    var kBuffers = Symbol("buffers");
    var kError = Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// ../node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "../node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// ../node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "../node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        this._mask = void 0;
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// ../node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "../node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var {
      types: { isUint8Array }
    } = __require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) {
          return dataLength ? [target, data] : [target];
        }
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (!dataLength) return [target];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// ../node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "../node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = Symbol("kCode");
    var kData = Symbol("kData");
    var kError = Symbol("kError");
    var kMessage = Symbol("kMessage");
    var kReason = Symbol("kReason");
    var kTarget = Symbol("kTarget");
    var kType = Symbol("kType");
    var kWasClean = Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// ../node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "../node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// ../node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "../node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var https = __require("https");
    var http = __require("http");
    var net = __require("net");
    var querystring = __require("querystring");
    var tls = __require("tls");
    var { randomBytes, createHash } = __require("crypto");
    var { Duplex, Readable } = __require("stream");
    var { URL: URL2 } = __require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            if (!options || options.protocols === void 0) {
              protocols = [];
            } else if (Array.isArray(options.protocols)) {
              protocols = options.protocols;
            } else {
              protocols = [options.protocols];
            }
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              if (options.protocols === void 0) {
                protocols = [];
              } else if (Array.isArray(options.protocols)) {
                protocols = options.protocols;
              } else {
                protocols = [options.protocols];
              }
            } else {
              protocols = [protocols];
            }
          }
          options = initAsClient(this, address, protocols, options);
        } else {
          this._isServer = true;
        }
        if (options.autoPong) {
          this._autoPong = true;
          this._autoPongComplete = () => autoPongComplete(this);
          this._pendingAutoPongs = 0;
          this._maxPendingAutoPongs = options.maxPendingAutoPongs | 0;
        }
        this._closeTimeout = options.closeTimeout;
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._readyState = _WebSocket.CLOSING;
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        maxPendingAutoPongs: 60,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        parsedUrl = new URL2(parsedUrl);
        parsedUrl.protocol = parsedUrl.protocol === "http:" ? "ws:" : "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        const username = querystring.unescape(parsedUrl.username);
        const password = querystring.unescape(parsedUrl.password);
        opts.auth = `${username}:${password}`;
      }
      if (isIpcUrl) {
        const i = opts.path.indexOf(":");
        if (i === -1) {
          opts.socketPath = opts.path;
          opts.path = "";
        } else {
          opts.socketPath = opts.path.slice(0, i);
          opts.path = opts.path.slice(i + 1);
        }
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
      return opts;
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeCode = code;
      if (reason.length === 0) {
        websocket._closeMessage = EMPTY_BUFFER;
      } else {
        websocket._closeMessage = Buffer.allocUnsafeSlow(reason.length);
        websocket._closeMessage.set(reason);
      }
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong && websocket.readyState === WebSocket2.OPEN) {
        if (websocket._maxPendingAutoPongs > 0 && websocket._pendingAutoPongs >= websocket._maxPendingAutoPongs) {
          websocket.terminate();
        } else {
          websocket._pendingAutoPongs++;
          websocket.pong(data, !this._isServer, websocket._autoPongComplete);
        }
      }
      websocket.emit("ping", data);
    }
    function autoPongComplete(websocket) {
      websocket._pendingAutoPongs--;
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// ../node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "../node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// ../node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "../node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse };
  }
});

// ../node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "../node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events");
    var http = __require("http");
    var { Duplex } = __require("stream");
    var { createHash } = __require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Number} [options.maxPendingAutoPongs=60] The maximum number of
       *     pending automatic pongs
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          maxPendingAutoPongs: 60,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// server/index.js
import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path2 from "node:path";
import { pathToFileURL, fileURLToPath as fileURLToPath2 } from "node:url";

// ../node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);

// server/rooms.js
import { randomUUID } from "node:crypto";

// src/core/cards.js
var SUITS = {
  spade: { label: "\u2660", color: "black" },
  heart: { label: "\u2665", color: "red" },
  club: { label: "\u2663", color: "black" },
  diamond: { label: "\u2666", color: "red" }
};
var RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
function shuffle(cards, rng = Math.random) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function buildDeck() {
  const deck = [];
  for (const suit of Object.keys(SUITS)) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        rank,
        suit,
        color: SUITS[suit].color,
        joker: null,
        label: rank,
        suitLabel: SUITS[suit].label
      });
    }
  }
  deck.push({
    id: "joker-SJ",
    rank: "SJ",
    suit: null,
    color: "black",
    joker: "SJ",
    label: "\u5C0F\u738B",
    suitLabel: ""
  });
  deck.push({
    id: "joker-BJ",
    rank: "BJ",
    suit: null,
    color: "red",
    joker: "BJ",
    label: "\u5927\u738B",
    suitLabel: ""
  });
  return deck;
}
function isJoker(card) {
  return !!card && !!card.joker;
}

// src/core/rules.js
function isPair(a, b) {
  return !!a && !!b && !isJoker(a) && !isJoker(b) && a.rank === b.rank;
}
function countPairs(collected) {
  const counts = {};
  for (const c of collected) {
    if (isJoker(c)) continue;
    counts[c.rank] = (counts[c.rank] || 0) + 1;
  }
  return Object.values(counts).reduce((s, n) => s + Math.floor(n / 2), 0);
}
function scoreFor(rankIndex, playerCount) {
  if (playerCount === 2) return [6, -2][rankIndex] ?? 0;
  if (playerCount === 3) return [6, 2, -2][rankIndex] ?? 0;
  return [6, 2, 0, -2][rankIndex] ?? 0;
}
function settle(players, playerCount) {
  const info = players.map((p) => ({
    seat: p.seat,
    collectedCount: p.collected.length,
    pairs: countPairs(p.collected)
  }));
  const ordered = [...info].sort(
    (a, b) => b.collectedCount - a.collectedCount || b.pairs - a.pairs || a.seat - b.seat
  );
  const ranks = ordered.map((it, i) => ({
    ...it,
    rank: i + 1,
    score: scoreFor(i, playerCount)
  }));
  const top = ordered[0];
  const winners = ordered.filter((o) => o.collectedCount === top.collectedCount && o.pairs === top.pairs).map((o) => o.seat);
  const scores = {};
  for (const r of ranks) scores[r.seat] = r.score;
  return { winner: top.seat, winners, ranks, scores };
}

// src/core/settings.js
var DEFAULT_SETTINGS = {
  playerCount: 4,
  difficulty: "normal",
  interferenceLimit: 3,
  muted: false
};
var PLAYER_COUNTS = [2, 3, 4];
var DIFFICULTIES = ["easy", "normal", "hard"];
function normalizeSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const playerCount = PLAYER_COUNTS.includes(Number(src.playerCount)) ? Number(src.playerCount) : DEFAULT_SETTINGS.playerCount;
  const difficulty = DIFFICULTIES.includes(src.difficulty) ? src.difficulty : DEFAULT_SETTINGS.difficulty;
  let interferenceLimit = Number(src.interferenceLimit);
  if (!Number.isInteger(interferenceLimit)) {
    interferenceLimit = DEFAULT_SETTINGS.interferenceLimit;
  }
  interferenceLimit = Math.min(5, Math.max(1, interferenceLimit));
  const muted = typeof src.muted === "boolean" ? src.muted : DEFAULT_SETTINGS.muted;
  return { playerCount, difficulty, interferenceLimit, muted };
}

// src/core/ai.js
var DIFFICULTY = {
  easy: {
    memoryAccuracy: 0.55,
    recallAccuracy: 0.5,
    interferenceRate: 0.15,
    peekRate: 0.3,
    baitRate: 0.2,
    blindRate: 0.1,
    thinkDelay: [1600, 2400]
  },
  normal: {
    memoryAccuracy: 0.8,
    recallAccuracy: 0.75,
    interferenceRate: 0.3,
    peekRate: 0.5,
    baitRate: 0.4,
    blindRate: 0.3,
    thinkDelay: [1200, 1900]
  },
  hard: {
    memoryAccuracy: 0.95,
    recallAccuracy: 0.92,
    interferenceRate: 0.45,
    peekRate: 0.7,
    baitRate: 0.65,
    blindRate: 0.5,
    thinkDelay: [900, 1500]
  }
};
var faceUpSlots = (g) => g.array.map((s, i) => s && s.faceUp ? i : null).filter((i) => i !== null);
var faceDownSlots = (g) => g.array.map((s, i) => s && !s.faceUp ? i : null).filter((i) => i !== null);
var emptySlots = (g) => g.array.map((s, i) => s ? null : i).filter((i) => i !== null);
var occupiedSlots = (g) => g.array.map((s, i) => s ? i : null).filter((i) => i !== null);
function randomOf(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}
function paramsOf(g) {
  return DIFFICULTY[g.settings.difficulty] || DIFFICULTY.normal;
}
function observePublic(g, slot, card) {
  const params = paramsOf(g);
  for (const p of g.players) {
    if (p.seat === 0) continue;
    if (g.rng() < params.memoryAccuracy) {
      p.memory.set(slot, { rank: card.rank, confidence: params.recallAccuracy, knownAt: g.turnNo });
    }
  }
}
function observePrivate(g, seat, slot, card) {
  const p = g.players[seat];
  if (p) p.memory.set(slot, { rank: card.rank, confidence: 1, knownAt: g.turnNo });
}
function forgetSlot(g, slot) {
  for (const p of g.players) p.memory.delete(slot);
}
function rememberedPair(g, seat, params) {
  const p = g.players[seat];
  const byRank = /* @__PURE__ */ new Map();
  for (const [slot, mem] of p.memory) {
    if (!g.array[slot] || g.array[slot].faceUp) continue;
    if (g.rng() < params.recallAccuracy) {
      if (!byRank.has(mem.rank)) byRank.set(mem.rank, []);
      byRank.get(mem.rank).push(Number(slot));
    }
  }
  for (const slots of byRank.values()) {
    if (slots.length >= 2) return [slots[0], slots[1]];
  }
  return null;
}
function findClaimable(g, seat, params, down) {
  const p = g.players[seat];
  const upByRank = /* @__PURE__ */ new Map();
  g.array.forEach((s, i) => {
    if (s && s.faceUp && !isJoker(s.card)) upByRank.set(s.card.rank, i);
  });
  if (!upByRank.size || down.length < 2) return null;
  for (const slot of down) {
    const mem = p.memory.get(slot);
    if (!mem || !upByRank.has(mem.rank)) continue;
    if (g.rng() >= params.recallAccuracy) continue;
    const second = down.find((s) => s !== slot);
    return { action: "flip", slots: [slot, second] };
  }
  return null;
}
function chooseFlip(g, seat, params, down) {
  if (down.length === 0) return null;
  const p = g.players[seat];
  const recalled = [];
  const unknown = [];
  for (const slot of down) {
    const mem = p.memory.get(slot);
    if (mem && g.rng() < params.recallAccuracy) recalled.push(slot);
    else unknown.push(slot);
  }
  const first = recalled[0] ?? unknown[0] ?? down[0];
  let secondPool = recalled.filter((s) => s !== first);
  if (!secondPool.length) secondPool = unknown.filter((s) => s !== first);
  if (!secondPool.length) secondPool = down.filter((s) => s !== first);
  if (!secondPool.length) return null;
  return { action: "flip", slots: [first, secondPool[0]] };
}
function chooseShift(g, seat, params, rng, up, occupied, normalHand) {
  const visibleRanks = new Set(
    g.array.filter((s) => s && s.faceUp).map((s) => s.card.rank)
  );
  let hand = randomOf(normalHand, rng);
  if (rng() < params.baitRate) {
    const bait = normalHand.filter((c) => !visibleRanks.has(c.rank));
    if (bait.length) hand = randomOf(bait, rng);
  }
  const targetSlot = up.length && rng() < Math.max(params.recallAccuracy, 0.4) ? randomOf(up, rng) : randomOf(occupied, rng);
  const mode = rng() < params.blindRate ? "mute" : "loud";
  return { action: "replace", handCardId: hand.id, targetSlot, mode };
}
function aiChooseAction(g, seat) {
  const p = g.players[seat];
  const params = paramsOf(g);
  const rng = g.rng;
  const down = faceDownSlots(g);
  const up = faceUpSlots(g);
  const empty = emptySlots(g);
  const occupied = occupiedSlots(g);
  const claim = findClaimable(g, seat, params, down);
  if (claim) return claim;
  const pair = rememberedPair(g, seat, params);
  if (pair) return { action: "flip", slots: pair };
  const normalHand = p.hand.filter((c) => !isJoker(c));
  const sj = p.hand.find((c) => c.joker === "SJ");
  const bj = p.hand.find((c) => c.joker === "BJ");
  const canReplace = p.interferenceUsed < g.settings.interferenceLimit && occupied.length > 0 && normalHand.length > 0;
  if (rng() < params.interferenceRate) {
    if (canReplace) return chooseShift(g, seat, params, rng, up, occupied, normalHand);
    if (bj && occupied.length) {
      return {
        action: "swap",
        handCardId: bj.id,
        targetSlot: randomOf(occupied, rng),
        emptySlot: empty.length ? randomOf(empty, rng) : null
      };
    }
    if (sj && down.length && rng() < params.peekRate) {
      return { action: "peek", handCardId: sj.id, slot: randomOf(down, rng) };
    }
  }
  const flip = chooseFlip(g, seat, params, down);
  if (flip) return flip;
  if (sj && down.length) return { action: "peek", handCardId: sj.id, slot: randomOf(down, rng) };
  if (canReplace) return chooseShift(g, seat, params, rng, up, occupied, normalHand);
  return { action: "skip" };
}
function aiThinkDelay(g) {
  const [a, b] = paramsOf(g).thinkDelay;
  return a + Math.floor(g.rng() * (b - a));
}

// src/core/game.js
var ARRAY_SIZE = 12;
var HAND_SIZE = 4;
var REFILL_BATCH = 4;
function createGame(rng = Math.random, settings = DEFAULT_SETTINGS) {
  return {
    rng,
    state: "DEAL",
    playerCount: 4,
    settings: normalizeSettings(settings),
    array: new Array(ARRAY_SIZE).fill(null),
    drawPile: [],
    discard: [],
    players: [],
    currentSeat: 0,
    turnNo: 1,
    pending: { first: null, second: null, stage: "idle" },
    // idle | picked | revealed | joker
    history: [],
    result: null
  };
}
function startGame(g, playerCount) {
  const n = [2, 3, 4].includes(playerCount) ? playerCount : g.settings.playerCount;
  g.playerCount = n;
  const deck = shuffle(buildDeck(), g.rng);
  for (let i = 0; i < ARRAY_SIZE; i++) {
    g.array[i] = { card: deck[i], faceUp: false };
  }
  let idx = ARRAY_SIZE;
  g.players = [];
  for (let seat = 0; seat < n; seat++) {
    const hand = deck.slice(idx, idx + HAND_SIZE);
    idx += HAND_SIZE;
    g.players.push({ seat, hand, collected: [], interferenceUsed: 0, memory: /* @__PURE__ */ new Map() });
  }
  g.drawPile = deck.slice(idx);
  g.discard = [];
  g.currentSeat = 0;
  g.turnNo = 1;
  g.pending = { first: null, second: null, stage: "idle" };
  g.history = [];
  g.result = null;
  g.state = "PLAYING";
  return { ok: true };
}
function flipCard(g, seat, slot) {
  if (g.state !== "PLAYING") return { ok: false, reason: "\u975E\u5BF9\u5C40\u9636\u6BB5" };
  if (seat !== g.currentSeat) return { ok: false, reason: "\u6CA1\u8F6E\u5230\u8BE5\u5EA7\u4F4D" };
  if (g.pending.stage === "revealed" || g.pending.stage === "joker") {
    return { ok: false, reason: "\u7FFB\u724C\u6BD4\u5BF9\u4E2D" };
  }
  if (!Number.isInteger(slot) || slot < 0 || slot >= ARRAY_SIZE) {
    return { ok: false, reason: "\u69FD\u4F4D\u975E\u6CD5" };
  }
  const s = g.array[slot];
  if (!s) return { ok: false, reason: "\u8BE5\u69FD\u4F4D\u4E3A\u7A7A" };
  if (s.faceUp) return { ok: false, reason: "\u8BE5\u724C\u5DF2\u7FFB\u5F00" };
  s.faceUp = true;
  observePublic(g, slot, s.card);
  if (isJoker(s.card) && g.pending.stage === "idle") {
    g.pending = { first: slot, second: null, stage: "joker" };
    g.history.push({ seat, action: "flip", slots: [slot], ok: true, joker: true, turnNo: g.turnNo });
    return { ok: true, joker: true };
  }
  if (g.pending.stage === "idle") {
    const claimSlot = g.array.findIndex(
      (c, i) => c && c.faceUp && i !== slot && !isJoker(c.card) && c.card.rank === s.card.rank
    );
    if (claimSlot >= 0) {
      g.pending = { first: claimSlot, second: slot, stage: "revealed", claim: true };
      g.history.push({
        seat,
        action: "flip",
        slots: [claimSlot, slot],
        ok: true,
        claim: true,
        turnNo: g.turnNo
      });
      return { ok: true, claimSlot };
    }
  }
  if (g.pending.stage === "idle") {
    g.pending.first = slot;
    g.pending.stage = "picked";
  } else {
    g.pending.second = slot;
    g.pending.stage = "revealed";
  }
  return { ok: true };
}
function resolvePair(g) {
  if (g.state !== "PLAYING") return { ok: false, reason: "\u975E\u5BF9\u5C40\u9636\u6BB5" };
  if (g.pending.stage !== "revealed") return { ok: false, reason: "\u65E0\u53EF\u6BD4\u5BF9\u7684\u4E24\u5F20\u724C" };
  const first = g.pending.first;
  const second = g.pending.second;
  const a = g.array[first];
  const b = g.array[second];
  if (!a || !b) return { ok: false, reason: "\u724C\u4F4D\u5DF2\u4E0D\u5B58\u5728" };
  const seat = g.currentSeat;
  const player = g.players[seat];
  let matched = false;
  let reason = "\u70B9\u6570\u4E0D\u540C";
  if (isJoker(a.card) || isJoker(b.card)) {
    reason = "\u738B\u724C\u4E0D\u53EF\u914D\u5BF9";
  } else if (isPair(a.card, b.card)) {
    matched = true;
    player.collected.push(a.card, b.card);
    g.array[first] = null;
    g.array[second] = null;
    forgetSlot(g, first);
    forgetSlot(g, second);
  }
  g.history.push({
    seat,
    action: "flip",
    slots: [first, second],
    ok: true,
    matched,
    reason,
    turnNo: g.turnNo
  });
  if (matched) {
    g.pending = { first: null, second: null, stage: "idle" };
  }
  return { ok: true, matched, reason };
}
function coverMismatch(g) {
  if (g.state !== "PLAYING") return { ok: false, reason: "\u975E\u5BF9\u5C40\u9636\u6BB5" };
  if (g.pending.stage !== "revealed") return { ok: false, reason: "\u6CA1\u6709\u5F85\u76D6\u56DE\u7684\u724C" };
  for (const i of [g.pending.first, g.pending.second]) {
    if (g.array[i]) g.array[i].faceUp = false;
  }
  g.pending = { first: null, second: null, stage: "idle" };
  return { ok: true };
}
function coverJoker(g) {
  if (g.state !== "PLAYING") return { ok: false, reason: "\u975E\u5BF9\u5C40\u9636\u6BB5" };
  if (g.pending.stage !== "joker") return { ok: false, reason: "\u6CA1\u6709\u5F85\u76D6\u56DE\u7684\u738B\u724C" };
  const i = g.pending.first;
  if (g.array[i]) g.array[i].faceUp = false;
  g.pending = { first: null, second: null, stage: "idle" };
  return { ok: true };
}
function shiftCard(g, seat, handCardId, targetSlot, mode = "loud") {
  if (g.state !== "PLAYING") return { ok: false, reason: "\u975E\u5BF9\u5C40\u9636\u6BB5" };
  if (seat !== g.currentSeat) return { ok: false, reason: "\u6CA1\u8F6E\u5230\u8BE5\u5EA7\u4F4D" };
  const player = g.players[seat];
  if (player.interferenceUsed >= g.settings.interferenceLimit) {
    return { ok: false, reason: "\u672C\u5C40\u5E72\u6270\u6B21\u6570\u5DF2\u7528\u5B8C" };
  }
  const handIdx = player.hand.findIndex((c) => c.id === handCardId);
  if (handIdx < 0) return { ok: false, reason: "\u624B\u724C\u4E2D\u4E0D\u5B58\u5728\u8BE5\u724C" };
  const card = player.hand[handIdx];
  if (isJoker(card)) return { ok: false, reason: "\u738B\u724C\u8BF7\u4F7F\u7528\u4E13\u5C5E\u884C\u52A8" };
  if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot >= ARRAY_SIZE) {
    return { ok: false, reason: "\u69FD\u4F4D\u975E\u6CD5" };
  }
  if (mode !== "loud" && mode !== "mute") return { ok: false, reason: "\u6295\u653E\u65B9\u5F0F\u975E\u6CD5" };
  const target = g.array[targetSlot];
  if (!target) return { ok: false, reason: "\u8BE5\u69FD\u4F4D\u4E3A\u7A7A\uFF0C\u65E0\u6CD5\u6539\u5199" };
  const displaced = target.card;
  player.hand.splice(handIdx, 1);
  target.card = card;
  target.faceUp = mode === "loud";
  if (g.drawPile.length > 0) g.drawPile.push(displaced);
  else g.discard.push(displaced);
  player.interferenceUsed += 1;
  forgetSlot(g, targetSlot);
  if (mode === "loud") observePublic(g, targetSlot, card);
  else observePrivate(g, seat, targetSlot, card);
  g.history.push({
    seat,
    action: "replace",
    slots: [targetSlot],
    handCardId,
    mode,
    ok: true,
    turnNo: g.turnNo
  });
  return { ok: true, mode, displaced };
}
function peekCard(g, seat, handCardId, slot) {
  if (g.state !== "PLAYING") return { ok: false, reason: "\u975E\u5BF9\u5C40\u9636\u6BB5" };
  if (seat !== g.currentSeat) return { ok: false, reason: "\u6CA1\u8F6E\u5230\u8BE5\u5EA7\u4F4D" };
  const player = g.players[seat];
  const handIdx = player.hand.findIndex((c) => c.id === handCardId);
  if (handIdx < 0) return { ok: false, reason: "\u624B\u724C\u4E2D\u4E0D\u5B58\u5728\u8BE5\u724C" };
  const joker = player.hand[handIdx];
  if (joker.joker !== "SJ") return { ok: false, reason: "\u8BE5\u724C\u4E0D\u662F\u5C0F\u738B" };
  const target = g.array[slot];
  if (!target || target.faceUp) return { ok: false, reason: "\u53EA\u80FD\u7AA5\u89C6\u80CC\u9762\u671D\u4E0A\u7684\u724C" };
  const peeked = target.card;
  player.hand.splice(handIdx, 1);
  g.discard.push(joker);
  observePrivate(g, seat, slot, peeked);
  g.history.push({ seat, action: "peek", slots: [slot], handCardId, ok: true, turnNo: g.turnNo });
  return { ok: true, peeked };
}
function swapJoker(g, seat, handCardId, targetSlot, emptySlot = null) {
  if (g.state !== "PLAYING") return { ok: false, reason: "\u975E\u5BF9\u5C40\u9636\u6BB5" };
  if (seat !== g.currentSeat) return { ok: false, reason: "\u6CA1\u8F6E\u5230\u8BE5\u5EA7\u4F4D" };
  const player = g.players[seat];
  const handIdx = player.hand.findIndex((c) => c.id === handCardId);
  if (handIdx < 0) return { ok: false, reason: "\u624B\u724C\u4E2D\u4E0D\u5B58\u5728\u8BE5\u724C" };
  const joker = player.hand[handIdx];
  if (joker.joker !== "BJ") return { ok: false, reason: "\u8BE5\u724C\u4E0D\u662F\u5927\u738B" };
  const target = g.array[targetSlot];
  if (!target) return { ok: false, reason: "\u76EE\u6807\u69FD\u4F4D\u4E3A\u7A7A" };
  const displaced = target.card;
  player.hand.splice(handIdx, 1);
  target.card = joker;
  target.faceUp = true;
  if (emptySlot != null && !g.array[emptySlot]) {
    g.array[emptySlot] = { card: displaced, faceUp: false };
  } else {
    g.discard.push(displaced);
  }
  forgetSlot(g, targetSlot);
  if (emptySlot != null) forgetSlot(g, emptySlot);
  g.history.push({
    seat,
    action: "swap",
    slots: [targetSlot, emptySlot].filter((x) => x != null),
    handCardId,
    ok: true,
    turnNo: g.turnNo
  });
  return { ok: true };
}
function skipTurn(g, seat) {
  if (g.state !== "PLAYING") return { ok: false, reason: "\u975E\u5BF9\u5C40\u9636\u6BB5" };
  if (seat !== g.currentSeat) return { ok: false, reason: "\u6CA1\u8F6E\u5230\u8BE5\u5EA7\u4F4D" };
  g.history.push({ seat, action: "skip", ok: true, turnNo: g.turnNo });
  return { ok: true };
}
function refillHands(g) {
  for (const p of g.players) {
    while (p.hand.length < HAND_SIZE && g.drawPile.length > 0) {
      p.hand.push(g.drawPile.shift());
    }
  }
}
function refillArray(g, batch = REFILL_BATCH) {
  let added = 0;
  for (let i = 0; i < ARRAY_SIZE && added < batch; i++) {
    if (!g.array[i] && g.drawPile.length > 0) {
      g.array[i] = { card: g.drawPile.shift(), faceUp: false };
      added += 1;
    }
  }
}
function isGameOver(g) {
  return g.array.every((s) => s === null) && g.drawPile.length === 0;
}
function endTurn(g) {
  refillHands(g);
  refillArray(g, REFILL_BATCH);
  if (isGameOver(g)) {
    g.result = settle(g.players, g.playerCount);
    g.state = "SETTLE";
    return;
  }
  g.currentSeat = (g.currentSeat + 1) % g.playerCount;
  g.turnNo += 1;
  g.pending = { first: null, second: null, stage: "idle" };
}
function viewOf(g, viewerSeat) {
  const me = g.players[viewerSeat];
  return {
    state: g.state,
    playerCount: g.playerCount,
    currentSeat: g.currentSeat,
    turnNo: g.turnNo,
    array: g.array.map((s, i) => s ? { slot: i, faceUp: s.faceUp, card: s.faceUp ? s.card : null } : null),
    drawCount: g.drawPile.length,
    myHand: me ? [...me.hand] : [],
    myCollected: me ? [...me.collected] : [],
    myInterferenceUsed: me ? me.interferenceUsed : 0,
    opponents: g.players.filter((p) => p.seat !== viewerSeat).map((p) => ({
      seat: p.seat,
      handCount: p.hand.length,
      collectedCount: p.collected.length,
      interferenceUsed: p.interferenceUsed
    })),
    pending: { ...g.pending },
    history: g.history,
    result: g.result,
    settings: { ...g.settings }
  };
}

// server/rooms.js
var GRACE_MS = 6e4;
var ROOM_IDLE_MS = 5 * 6e4;
function makeToken() {
  return randomUUID();
}
var RoomManager = class {
  constructor() {
    this.rooms = /* @__PURE__ */ new Map();
    this.tokens = /* @__PURE__ */ new Map();
    this.now = () => Date.now();
  }
  roomStateOf(room) {
    return room.g ? room.g.state : "WAITING";
  }
  isSettling(room) {
    return !!room.g && room.g.state === "SETTLE";
  }
  roomState(room) {
    return {
      roomId: room.roomId,
      state: this.roomStateOf(room),
      settling: this.isSettling(room),
      settings: { ...room.settings },
      members: room.members.map((m) => ({
        seat: m.seat,
        name: m.name,
        connected: m.connected,
        gone: m.gone,
        ready: m.ready,
        isHost: m.isHost,
        isAI: m.isAI,
        token: m.token,
        settled: room.settleAck.has(m.seat)
      }))
    };
  }
  listRooms() {
    return [...this.rooms.values()].filter((r) => {
      if (this.roomStateOf(r) !== "WAITING") return false;
      const humans = r.members.filter((m) => !m.isAI && m.connected && !m.gone);
      return humans.length > 0 && r.members.length < r.settings.playerCount;
    }).sort((a, b) => a.createdAt - b.createdAt).map((r) => ({
      roomId: r.roomId,
      settings: { ...r.settings },
      members: r.members.filter((m) => !m.isAI).map((m) => ({ name: m.name, connected: m.connected, isHost: m.isHost }))
    }));
  }
  broadcast(room, type, payload, exceptToken = null) {
    for (const m of room.members) {
      if (m.token === exceptToken || !m.conn) continue;
      m.conn.send({ type, payload });
    }
  }
  pushRoomState(room, exceptToken = null) {
    this.broadcast(room, "room.state", { room: this.roomState(room) }, exceptToken);
  }
  firstVacantSeat(room) {
    const used = new Set(room.members.map((m) => m.seat));
    for (let s = 0; s < room.settings.playerCount; s++) if (!used.has(s)) return s;
    return -1;
  }
  findMemberByConn(conn) {
    for (const room of this.rooms.values()) {
      const m = room.members.find((mm) => mm.conn === conn);
      if (m) return { room, member: m };
    }
    return null;
  }
  removeMember(room, member) {
    room.members = room.members.filter((m) => m !== member);
    this.tokens.delete(member.token);
    room.lastActiveAt = this.now();
    if (room.members.length === 0) {
      this.destroyRoom(room.roomId);
      return;
    }
    if (member.isHost) this.promoteHost(room);
    this.pushRoomState(room);
  }
  promoteHost(room) {
    const next = room.members[0];
    if (next) {
      next.isHost = true;
      next.ready = true;
    }
  }
  hasLiveHost(room) {
    return room.members.some((m) => m.isHost && !m.isAI && m.connected && !m.gone);
  }
  destroyRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const m of room.members) {
      this.tokens.delete(m.token);
      if (m.graceTimer) clearTimeout(m.graceTimer);
      m.conn = null;
    }
    for (const t of room.timers || []) clearTimeout(t);
    this.rooms.delete(roomId);
  }
  tryRejoin(conn, name, oldToken) {
    if (!oldToken) return null;
    const room = this.roomOf(oldToken);
    if (!room || this.roomStateOf(room) !== "WAITING") return null;
    const existing = this.memberByToken(room, oldToken);
    if (!existing || existing.isAI || existing.gone) return null;
    return this.rejoinRoom(conn, name, room.roomId, oldToken);
  }
  newRoomId() {
    for (; ; ) {
      const id = 1e5 + Math.floor(Math.random() * 9e5);
      if (!this.rooms.has(id)) return id;
    }
  }
  rejoinRoom(conn, name, roomId, oldToken) {
    const room = this.rooms.get(roomId);
    if (!room || this.roomStateOf(room) !== "WAITING") return null;
    const existing = oldToken ? this.memberByToken(room, oldToken) : null;
    if (!existing || existing.isAI) return null;
    if (room.members.some((m) => m !== existing && m.seat === existing.seat)) return null;
    if (existing.graceTimer) {
      clearTimeout(existing.graceTimer);
      existing.graceTimer = null;
    }
    existing.name = name;
    existing.connected = true;
    if (existing.conn && existing.conn !== conn) {
      try {
        existing.conn.close();
      } catch {
      }
    }
    existing.conn = conn;
    room.lastActiveAt = this.now();
    this.pushRoomState(room);
    return { room, token: existing.token, seat: existing.seat, rejoined: true };
  }
  createRoom(conn, name, oldToken = "") {
    const existing = this.findMemberByConn(conn);
    if (existing && this.roomStateOf(existing.room) !== "WAITING") {
      return { error: { code: "ROOM_STARTED", message: "\u5BF9\u5C40\u8FDB\u884C\u4E2D\uFF0C\u4E0D\u80FD\u66F4\u6362\u623F\u95F4" } };
    }
    if (existing) {
      existing.member.name = name;
      this.pushRoomState(existing.room);
      return { room: existing.room, token: existing.member.token, seat: existing.member.seat, rejoined: true };
    }
    const rejoined = this.tryRejoin(conn, name, oldToken);
    if (rejoined) return rejoined;
    const roomId = this.newRoomId();
    const room = {
      roomId,
      members: [],
      g: null,
      settleAck: /* @__PURE__ */ new Set(),
      createdAt: this.now(),
      lastActiveAt: this.now(),
      timers: /* @__PURE__ */ new Set(),
      settings: { ...DEFAULT_SETTINGS }
    };
    this.rooms.set(roomId, room);
    return this.joinRoom(conn, name, roomId);
  }
  joinRoom(conn, name, roomId, oldToken = "") {
    const room = this.rooms.get(roomId);
    if (!room) return { error: { code: "ROOM_GONE", message: "\u623F\u95F4\u4E0D\u5B58\u5728\u6216\u5DF2\u89E3\u6563" } };
    if (this.roomStateOf(room) !== "WAITING") return { error: { code: "ROOM_STARTED", message: "\u5BF9\u5C40\u5DF2\u5F00\u59CB\uFF0C\u65E0\u6CD5\u52A0\u5165" } };
    const rejoined = this.tryRejoin(conn, name, oldToken);
    if (rejoined && rejoined.room === room) return rejoined;
    const seat = this.firstVacantSeat(room);
    if (seat === -1) return { error: { code: "ROOM_FULL", message: "\u623F\u95F4\u5DF2\u6EE1" } };
    const existing = this.findMemberByConn(conn);
    if (existing && existing.room !== room) {
      if (this.roomStateOf(existing.room) !== "WAITING") {
        return { error: { code: "ROOM_STARTED", message: "\u5BF9\u5C40\u8FDB\u884C\u4E2D\uFF0C\u4E0D\u80FD\u66F4\u6362\u623F\u95F4" } };
      }
      this.removeMember(existing.room, existing.member);
    }
    const token = makeToken();
    const member = {
      seat,
      token,
      name,
      connected: true,
      gone: false,
      ready: room.members.length === 0,
      isHost: room.members.length === 0,
      isAI: false,
      conn,
      graceTimer: null,
      aiTimer: null
    };
    room.members.push(member);
    this.tokens.set(token, room);
    room.lastActiveAt = this.now();
    this.pushRoomState(room);
    return { room, token, seat };
  }
  quickMatch(conn, name, oldToken = "") {
    const rejoined = this.tryRejoin(conn, name, oldToken);
    if (rejoined) return rejoined;
    const candidates = [...this.rooms.values()].filter((r) => this.roomStateOf(r) === "WAITING" && this.firstVacantSeat(r) !== -1).sort((a, b) => a.createdAt - b.createdAt);
    if (candidates.length > 0) return this.joinRoom(conn, name, candidates[0].roomId);
    return this.createRoom(conn, name);
  }
  roomOf(token) {
    return this.tokens.get(token) || null;
  }
  memberByToken(room, token) {
    return room.members.find((m) => m.token === token) || null;
  }
  moveSeat(token, roomId, seat) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: { code: "ROOM_GONE", message: "\u623F\u95F4\u4E0D\u5B58\u5728" } };
    if (this.roomStateOf(room) !== "WAITING") return { error: { code: "ROOM_STARTED", message: "\u5BF9\u5C40\u4E2D\u4E0D\u80FD\u6362\u5EA7\u4F4D" } };
    const me = this.memberByToken(room, token);
    if (!me) return { error: { code: "NOT_IN_ROOM", message: "\u4E0D\u5728\u6B64\u623F\u95F4" } };
    if (!Number.isInteger(seat) || seat < 0 || seat >= room.settings.playerCount) return { error: { code: "SEAT_INVALID", message: "\u5EA7\u4F4D\u53F7\u975E\u6CD5" } };
    if (seat === me.seat) return { ok: true };
    const target = room.members.find((m) => m.seat === seat);
    if (target) return { error: { code: "SEAT_TAKEN", message: "\u8BE5\u5EA7\u4F4D\u5DF2\u6709\u4EBA" } };
    me.seat = seat;
    room.lastActiveAt = this.now();
    this.pushRoomState(room);
    return { ok: true };
  }
  setReady(token, roomId, ready) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: { code: "ROOM_GONE", message: "\u623F\u95F4\u4E0D\u5B58\u5728" } };
    if (this.roomStateOf(room) !== "WAITING") return { error: { code: "ROOM_STARTED", message: "\u5BF9\u5C40\u4E2D\u4E0D\u80FD\u4FEE\u6539\u51C6\u5907\u72B6\u6001" } };
    const me = this.memberByToken(room, token);
    if (!me) return { error: { code: "NOT_IN_ROOM", message: "\u4E0D\u5728\u6B64\u623F\u95F4" } };
    me.ready = !!ready;
    room.lastActiveAt = this.now();
    this.pushRoomState(room);
    return { ok: true };
  }
  setRoomSettings(token, roomId, raw) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: { code: "ROOM_GONE", message: "\u623F\u95F4\u4E0D\u5B58\u5728" } };
    if (this.roomStateOf(room) !== "WAITING") return { error: { code: "ROOM_STARTED", message: "\u5BF9\u5C40\u4E2D\u4E0D\u80FD\u4FEE\u6539\u8BBE\u7F6E" } };
    const me = this.memberByToken(room, token);
    if (!me) return { error: { code: "NOT_IN_ROOM", message: "\u4E0D\u5728\u6B64\u623F\u95F4" } };
    if (!me.isHost) return { error: { code: "NOT_HOST", message: "\u53EA\u6709\u623F\u4E3B\u80FD\u4FEE\u6539\u8BBE\u7F6E" } };
    room.settings = normalizeSettings(raw);
    room.lastActiveAt = this.now();
    this.pushRoomState(room);
    return { ok: true };
  }
  // ---------- 对局 ----------
  canStart(room) {
    if (room.members.length === 0) return { ok: false, message: "\u9700\u8981\u81F3\u5C11 1 \u540D\u73A9\u5BB6" };
    if (!room.members.every((m) => m.ready || m.isAI)) return { ok: false, message: "\u6240\u6709\u73A9\u5BB6\u987B\u5148\u51C6\u5907" };
    return { ok: true };
  }
  fillWithAI(room) {
    const used = new Set(room.members.map((m) => m.seat));
    for (let seat = 0; seat < room.settings.playerCount; seat++) {
      if (used.has(seat)) continue;
      room.members.push({
        seat,
        token: null,
        name: `AI\xB7\u56DE\u58F0${seat}`,
        connected: true,
        gone: false,
        ready: true,
        isHost: false,
        isAI: true,
        conn: null,
        graceTimer: null,
        aiTimer: null
      });
    }
  }
  startGame(token, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: { code: "ROOM_GONE", message: "\u623F\u95F4\u4E0D\u5B58\u5728" } };
    if (this.roomStateOf(room) !== "WAITING") return { error: { code: "ROOM_STARTED", message: "\u5BF9\u5C40\u5DF2\u5F00\u59CB" } };
    const me = this.memberByToken(room, token);
    if (!me || !me.isHost) return { error: { code: "NOT_HOST", message: "\u53EA\u6709\u623F\u4E3B\u80FD\u5F00\u59CB" } };
    this.fillWithAI(room);
    const check = this.canStart(room);
    if (!check.ok) return { error: { code: "CANNOT_START", message: check.message } };
    this.pushRoomState(room);
    const g = createGame(Math.random, room.settings);
    startGame(g, room.settings.playerCount);
    room.g = g;
    room.settleAck = /* @__PURE__ */ new Set();
    room.timers = /* @__PURE__ */ new Set();
    this.pushGameState(room);
    this.scheduleAiTurn(room);
    return { ok: true };
  }
  pushGameState(room, onlySeat = null) {
    for (const m of room.members) {
      if (!m.conn) continue;
      if (onlySeat !== null && m.seat !== onlySeat) continue;
      m.conn.send({ type: "game.state", payload: this.gameView(room, m.seat) });
    }
  }
  gameView(room, seat) {
    const names = {};
    for (const m of room.members) names[m.seat] = m.name;
    return { view: viewOf(room.g, seat), fx: { mode: "flip" }, roomId: room.roomId, yourSeat: seat, names };
  }
  /** 校验身份与轮次后执行动作；失败只经返回值回传，不改状态 */
  gameAction(token, type, payload) {
    payload = payload || {};
    const room = this.roomOf(token);
    if (!room) return { error: { code: "NOT_IN_ROOM", message: "\u4E0D\u5728\u6B64\u623F\u95F4" } };
    const me = this.memberByToken(room, token);
    if (!me) return { error: { code: "NOT_IN_ROOM", message: "\u4E0D\u5728\u6B64\u623F\u95F4" } };
    const g = room.g;
    if (!g) return { error: { code: "NO_GAME", message: "\u5BF9\u5C40\u672A\u5F00\u59CB" } };
    if (g.state !== "PLAYING") return { error: { code: "BAD_STATE", message: "\u975E\u5BF9\u5C40\u9636\u6BB5" } };
    if (g.currentSeat !== me.seat) return { error: { code: "NOT_YOUR_TURN", message: "\u6CA1\u8F6E\u5230\u4F60" } };
    if (me.aiTimer) return { error: { code: "NOT_YOUR_TURN", message: "\u6258\u7BA1\u4E2D" } };
    let res;
    switch (type) {
      case "game.flip": {
        const slot = Number(payload.slot);
        res = flipCard(g, me.seat, slot);
        if (!res.ok) return { error: { code: "ILLEGAL", message: res.reason } };
        if (res.joker) {
          coverJoker(g);
          this.afterAction(room);
          return { ok: true };
        }
        if (g.pending.stage === "revealed") {
          const pair = resolvePair(g);
          if (pair.ok && !pair.matched) coverMismatch(g);
          this.afterAction(room);
        } else {
          this.pushGameState(room);
        }
        return { ok: true };
      }
      case "game.replace": {
        const mode = payload.mode === "mute" ? "mute" : "loud";
        res = shiftCard(g, me.seat, payload.handCardId, Number(payload.targetSlot), mode);
        if (!res.ok) return { error: { code: "ILLEGAL", message: res.reason } };
        this.afterAction(room);
        return { ok: true };
      }
      case "game.peek": {
        res = peekCard(g, me.seat, payload.handCardId, Number(payload.slot));
        if (!res.ok) return { error: { code: "ILLEGAL", message: res.reason } };
        this.afterAction(room);
        return { ok: true };
      }
      case "game.swap": {
        const empty = payload.emptySlot == null ? null : Number(payload.emptySlot);
        res = swapJoker(g, me.seat, payload.handCardId, Number(payload.targetSlot), empty);
        if (!res.ok) return { error: { code: "ILLEGAL", message: res.reason } };
        this.afterAction(room);
        return { ok: true };
      }
      case "game.skip": {
        res = skipTurn(g, me.seat);
        if (!res.ok) return { error: { code: "ILLEGAL", message: res.reason } };
        this.afterAction(room);
        return { ok: true };
      }
      case "game.settleContinue":
        return this.settleContinue(room, me);
      default:
        return { error: { code: "UNKNOWN_ACTION", message: "\u672A\u77E5\u52A8\u4F5C" } };
    }
  }
  /** 动作收尾：结束回合 → 终局下发结算 / 推视图并调度 AI */
  afterAction(room) {
    const g = room.g;
    endTurn(g);
    if (g.state === "SETTLE") {
      for (const m of room.members) {
        if (!m.conn) continue;
        m.conn.send({ type: "game.over", payload: { result: g.result, view: viewOf(g, m.seat) } });
      }
      this.pushRoomState(room);
      return;
    }
    this.pushGameState(room);
    this.scheduleAiTurn(room);
  }
  /** 轮到 AI/掉线托管座位：按难度延时后代打 */
  scheduleAiTurn(room) {
    const g = room.g;
    if (!g || g.state !== "PLAYING") return;
    const seat = g.currentSeat;
    const member = room.members.find((m) => m.seat === seat);
    if (!member || !member.isAI && !member.aiTimer) return;
    const delay = aiThinkDelay(g);
    const t = setTimeout(() => {
      room.timers.delete(t);
      if (room.g !== g || g.state !== "PLAYING" || g.currentSeat !== seat) return;
      const m2 = room.members.find((x) => x.seat === seat);
      if (!m2 || !m2.isAI && !m2.aiTimer) return;
      const choice = aiChooseAction(g, seat);
      let ok = true;
      switch (choice.action) {
        case "flip": {
          const [a, b] = choice.slots;
          const r1 = flipCard(g, seat, a);
          if (r1.ok && r1.joker) {
            coverJoker(g);
            break;
          }
          flipCard(g, seat, b);
          const pair = resolvePair(g);
          if (pair.ok && !pair.matched) coverMismatch(g);
          break;
        }
        case "replace":
          ok = shiftCard(g, seat, choice.handCardId, choice.targetSlot, choice.mode).ok;
          break;
        case "peek":
          ok = peekCard(g, seat, choice.handCardId, choice.slot).ok;
          break;
        case "swap":
          ok = swapJoker(g, seat, choice.handCardId, choice.targetSlot, choice.emptySlot ?? null).ok;
          break;
        default:
          ok = skipTurn(g, seat).ok;
      }
      if (ok) this.afterAction(room);
    }, delay);
    room.timers.add(t);
  }
  // ---------- 断线/重连/离开/销毁 ----------
  onConnClose(conn) {
    if (!conn.token) return;
    this.onDisconnect(conn.token, conn);
  }
  onDisconnect(token, conn = null) {
    const room = this.roomOf(token);
    if (!room) return;
    const me = this.memberByToken(room, token);
    if (!me) return;
    if (conn && me.conn && me.conn !== conn) return;
    if (this.roomStateOf(room) === "WAITING") {
      if (me.graceTimer) {
        clearTimeout(me.graceTimer);
        me.graceTimer = null;
      }
      this.removeMember(room, me);
      return;
    }
    me.connected = false;
    me.conn = null;
    if (me.graceTimer) clearTimeout(me.graceTimer);
    me.graceTimer = setTimeout(() => {
      if (me.connected || me.gone) return;
      me.gone = true;
      this.tokens.delete(token);
      this.pushRoomState(room);
    }, GRACE_MS);
    this.enableAiControl(room, me);
    this.pushRoomState(room);
  }
  enableAiControl(room, member) {
    if (member.isAI || member.aiTimer) return;
    member.aiTimer = true;
    if (room.g && room.g.state === "PLAYING" && room.g.currentSeat === member.seat) this.scheduleAiTurn(room);
  }
  disableAiControl(member) {
    member.aiTimer = null;
  }
  checkSession(token) {
    const room = this.roomOf(token);
    if (!room) return null;
    const me = this.memberByToken(room, token);
    if (!me || me.gone) return null;
    return { roomId: room.roomId, state: this.roomStateOf(room) };
  }
  reconnect(conn, token) {
    const room = this.roomOf(token);
    if (!room) return { error: { code: "ROOM_GONE", message: "\u623F\u95F4\u5DF2\u89E3\u6563" } };
    const me = this.memberByToken(room, token);
    if (!me || me.gone) return { error: { code: "ROOM_GONE", message: "\u623F\u95F4\u5DF2\u89E3\u6563" } };
    if (me.conn && me.conn !== conn) {
      try {
        me.conn.close();
      } catch {
      }
    }
    me.conn = conn;
    me.connected = true;
    if (me.graceTimer) {
      clearTimeout(me.graceTimer);
      me.graceTimer = null;
    }
    this.disableAiControl(me);
    conn.send({ type: "room.state", payload: { room: this.roomState(room) } });
    if (room.g) conn.send({ type: "game.state", payload: this.gameView(room, me.seat) });
    this.pushRoomState(room, token);
    return { room, seat: me.seat };
  }
  leave(token) {
    const room = this.roomOf(token);
    if (!room) return { ok: true };
    const me = this.memberByToken(room, token);
    if (!me) return { ok: true };
    if (me.graceTimer) {
      clearTimeout(me.graceTimer);
      me.graceTimer = null;
    }
    if (this.roomStateOf(room) === "WAITING") {
      this.removeMember(room, me);
      return { ok: true };
    }
    if (me.conn) {
      try {
        me.conn.close();
      } catch {
      }
    }
    this.onDisconnect(token);
    return { ok: true };
  }
  kickMember(hostToken, roomId, targetToken) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: { code: "ROOM_GONE", message: "\u623F\u95F4\u4E0D\u5B58\u5728" } };
    if (this.roomStateOf(room) !== "WAITING") return { error: { code: "ROOM_STARTED", message: "\u5BF9\u5C40\u4E2D\u4E0D\u80FD\u79FB\u51FA\u73A9\u5BB6" } };
    const host = this.memberByToken(room, hostToken);
    if (!host || !host.isHost) return { error: { code: "NOT_HOST", message: "\u53EA\u6709\u623F\u4E3B\u80FD\u79FB\u51FA\u73A9\u5BB6" } };
    const target = this.memberByToken(room, targetToken);
    if (!target) return { error: { code: "NOT_IN_ROOM", message: "\u5BF9\u65B9\u4E0D\u5728\u6B64\u623F\u95F4" } };
    if (target === host) return { error: { code: "BAD_REQUEST", message: "\u4E0D\u80FD\u79FB\u51FA\u81EA\u5DF1" } };
    if (target.conn) target.conn.send({ type: "kicked", payload: { message: "\u4F60\u5DF2\u88AB\u623F\u4E3B\u79FB\u51FA\u623F\u95F4" } });
    this.removeMember(room, target);
    return { ok: true };
  }
  pokeMember(hostToken, roomId, targetToken) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: { code: "ROOM_GONE", message: "\u623F\u95F4\u4E0D\u5B58\u5728" } };
    if (this.roomStateOf(room) !== "WAITING") return { error: { code: "ROOM_STARTED", message: "\u5BF9\u5C40\u4E2D\u65E0\u9700\u63D0\u9192" } };
    const host = this.memberByToken(room, hostToken);
    if (!host || !host.isHost) return { error: { code: "NOT_HOST", message: "\u53EA\u6709\u623F\u4E3B\u80FD\u63D0\u9192\u51C6\u5907" } };
    const target = this.memberByToken(room, targetToken);
    if (!target) return { error: { code: "NOT_IN_ROOM", message: "\u5BF9\u65B9\u4E0D\u5728\u6B64\u623F\u95F4" } };
    if (target === host) return { error: { code: "BAD_REQUEST", message: "\u4E0D\u80FD\u63D0\u9192\u81EA\u5DF1" } };
    if (target.isAI) return { error: { code: "BAD_REQUEST", message: "AI \u65E0\u9700\u63D0\u9192" } };
    if (target.ready) return { error: { code: "ALREADY_READY", message: "\u5BF9\u65B9\u5DF2\u51C6\u5907" } };
    if (target.conn) target.conn.send({ type: "poke", payload: { message: "\u623F\u4E3B\u63D0\u9192\u4F60\u51C6\u5907" } });
    return { ok: true };
  }
  sweep() {
    for (const room of [...this.rooms.values()]) {
      const state = this.roomStateOf(room);
      const alive = room.members.some((m) => (m.connected || m.isAI) && !m.gone);
      if (state !== "WAITING") {
        const allGone = room.members.length > 0 && room.members.every((m) => m.gone);
        if (allGone) this.destroyRoom(room.roomId);
        continue;
      }
      if (!alive) {
        this.destroyRoom(room.roomId);
        continue;
      }
      if (!this.hasLiveHost(room)) {
        const humans = room.members.filter((m) => !m.isAI);
        if (humans.length === 0) {
          this.destroyRoom(room.roomId);
          continue;
        }
        this.promoteHost(room);
        this.pushRoomState(room);
      }
      if (this.now() - (room.lastActiveAt ?? room.createdAt) >= ROOM_IDLE_MS) {
        this.destroyRoom(room.roomId);
      }
    }
  }
  settleContinue(room, me) {
    if (!room.g || room.g.state !== "SETTLE") return { error: { code: "BAD_STATE", message: "\u975E\u7ED3\u7B97\u9636\u6BB5" } };
    room.settleAck.add(me.seat);
    me.ready = true;
    const active = room.members.filter((m) => !m.gone && !m.isAI).length;
    if (active === 0 || room.settleAck.size >= active) {
      this.finishSettle(room);
    } else {
      if (!room.settleTimer) {
        room.settleTimer = setTimeout(() => this.finishSettle(room), 5e3);
        room.timers.add(room.settleTimer);
      }
      this.pushRoomState(room);
    }
    return { ok: true };
  }
  finishSettle(room) {
    if (room.settleTimer) {
      clearTimeout(room.settleTimer);
      room.timers.delete(room.settleTimer);
      room.settleTimer = null;
    }
    if (!room.g || room.g.state !== "SETTLE") return;
    room.g = null;
    room.settleAck = /* @__PURE__ */ new Set();
    room.lastActiveAt = this.now();
    for (const m of [...room.members]) {
      if (m.isAI || !m.connected || m.gone) {
        if (m.graceTimer) {
          clearTimeout(m.graceTimer);
          m.graceTimer = null;
        }
        this.tokens.delete(m.token);
        room.members = room.members.filter((x) => x !== m);
      }
    }
    if (room.members.length === 0) {
      this.destroyRoom(room.roomId);
      return;
    }
    if (!room.members.some((m) => m.isHost)) this.promoteHost(room);
    for (const m of room.members) m.ready = true;
    this.pushRoomState(room);
  }
};

// server/port.js
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function readPort() {
  if (process.env.PORT) return Number(process.env.PORT);
  try {
    const cfg = JSON.parse(readFileSync(path.join(ROOT, "config.json"), "utf8"));
    if (Number.isInteger(cfg.wsPort)) return cfg.wsPort;
  } catch {
  }
  return 3006;
}

// server/index.js
var HEARTBEAT_MS = 15e3;
function createServerApp(port = readPort(), { heartbeatMs = HEARTBEAT_MS } = {}) {
  const mgr = new RoomManager();
  const staticDir = process.env.STATIC_DIR ? path2.resolve(process.env.STATIC_DIR) : path2.resolve(path2.dirname(fileURLToPath2(import.meta.url)), "../dist/build/h5");
  let staticReady = null;
  const httpServer = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.includes("..")) {
        res.writeHead(403).end();
        return;
      }
      if (pathname === "/") pathname = "/index.html";
      const file = path2.join(staticDir, pathname);
      if (!file.startsWith(staticDir)) {
        res.writeHead(403).end();
        return;
      }
      staticReady ||= fs.readdir(staticDir).then(() => true, () => false);
      if (!await staticReady) {
        res.writeHead(426).end("WebSocket only");
        return;
      }
      const data = await fs.readFile(file).catch(() => null);
      if (data === null) {
        const index = await fs.readFile(path2.join(staticDir, "index.html")).catch(() => null);
        if (index === null) {
          res.writeHead(404).end("Not Found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(index);
        return;
      }
      const ext = path2.extname(file).toLowerCase();
      const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".wav": "audio/wav" };
      res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" }).end(data);
    } catch (e) {
      console.error("[server] static error:", e.message);
      res.writeHead(500).end();
    }
  });
  const wss = new import_websocket_server.default({ server: httpServer, maxPayload: 64 * 1024 });
  wss.on("connection", (socket) => {
    const conn = {
      raw: socket,
      token: null,
      alive: true,
      send(obj) {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(obj));
      },
      close() {
        try {
          socket.close();
        } catch {
        }
      }
    };
    socket.on("error", (err) => console.error("[server] socket error:", err.message));
    socket.on("pong", () => {
      conn.alive = true;
    });
    socket.on("message", () => {
      conn.alive = true;
    });
    const beat = setInterval(() => {
      if (socket.readyState !== socket.OPEN) {
        clearInterval(beat);
        return;
      }
      if (!conn.alive) {
        clearInterval(beat);
        socket.terminate();
        return;
      }
      conn.alive = false;
      try {
        socket.ping();
      } catch {
      }
    }, heartbeatMs);
    beat.unref?.();
    socket.on("close", () => {
      clearInterval(beat);
      mgr.onConnClose(conn);
    });
    socket.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        conn.send({ type: "error", payload: { code: "BAD_JSON", message: "\u6D88\u606F\u683C\u5F0F\u9519\u8BEF" } });
        return;
      }
      try {
        handle(mgr, conn, msg);
      } catch (e) {
        conn.send({ type: "error", payload: { code: "INTERNAL", message: "\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF" } });
        console.error("[server] handle error:", e);
      }
    });
  });
  const sweepTimer = setInterval(() => mgr.sweep(), 3e4);
  sweepTimer.unref?.();
  return { httpServer, wss, port, mgr };
}
function handle(mgr, conn, msg) {
  const { type, requestId } = msg || {};
  const payload = msg && msg.payload || {};
  const reply = (t, p) => conn.send({ type: t, payload: p, ...requestId ? { requestId } : {} });
  const replyError = (code, message) => reply("error", { code, message });
  switch (type) {
    case "room.list":
      return reply("room.list.ok", { rooms: mgr.listRooms() });
    case "room.create": {
      const { room, token, seat, error } = mgr.createRoom(conn, sanitizeName(payload.name), String(payload.token || ""));
      if (error) return replyError(error.code, error.message);
      conn.token = token;
      return reply("room.created", { room: mgr.roomState(room), token, yourSeat: seat });
    }
    case "room.join": {
      const roomId = Number(payload.roomId);
      if (!Number.isInteger(roomId)) return replyError("BAD_REQUEST", "\u623F\u95F4\u53F7\u975E\u6CD5");
      const { room, token, seat, error } = mgr.joinRoom(conn, sanitizeName(payload.name), roomId, String(payload.token || ""));
      if (error) return replyError(error.code, error.message);
      conn.token = token;
      return reply("room.joined", { room: mgr.roomState(room), token, yourSeat: seat });
    }
    case "room.quickMatch": {
      const { room, token, seat, error } = mgr.quickMatch(conn, sanitizeName(payload.name), String(payload.token || ""));
      if (error) return replyError(error.code, error.message);
      conn.token = token;
      return reply("room.joined", { room: mgr.roomState(room), token, yourSeat: seat });
    }
    case "room.seat": {
      const room = mgr.roomOf(conn.token);
      if (!room) return replyError("NOT_IN_ROOM", "\u4E0D\u5728\u6B64\u623F\u95F4");
      const res = mgr.moveSeat(conn.token, room.roomId, Number(payload.seat));
      if (res.error) return replyError(res.error.code, res.error.message);
      return reply("room.seat.ok", {});
    }
    case "room.ready": {
      const room = mgr.roomOf(conn.token);
      if (!room) return replyError("NOT_IN_ROOM", "\u4E0D\u5728\u6B64\u623F\u95F4");
      const res = mgr.setReady(conn.token, room.roomId, !!payload.ready);
      if (res.error) return replyError(res.error.code, res.error.message);
      return reply("room.ready.ok", {});
    }
    case "room.kick": {
      const room = mgr.roomOf(conn.token);
      if (!room) return replyError("NOT_IN_ROOM", "\u4E0D\u5728\u6B64\u623F\u95F4");
      const res = mgr.kickMember(conn.token, room.roomId, String(payload.token || ""));
      if (res.error) return replyError(res.error.code, res.error.message);
      return reply("room.kick.ok", {});
    }
    case "room.poke": {
      const room = mgr.roomOf(conn.token);
      if (!room) return replyError("NOT_IN_ROOM", "\u4E0D\u5728\u6B64\u623F\u95F4");
      const res = mgr.pokeMember(conn.token, room.roomId, String(payload.token || ""));
      if (res.error) return replyError(res.error.code, res.error.message);
      return reply("room.poke.ok", {});
    }
    case "room.leave": {
      reply("room.left", {});
      mgr.leave(conn.token);
      conn.token = null;
      return;
    }
    case "room.setSettings": {
      const room = mgr.roomOf(conn.token);
      if (!room) return replyError("NOT_IN_ROOM", "\u4E0D\u5728\u6B64\u623F\u95F4");
      const res = mgr.setRoomSettings(conn.token, room.roomId, payload.settings);
      if (res.error) return replyError(res.error.code, res.error.message);
      return reply("room.setSettings.ok", {});
    }
    case "game.start": {
      const room = mgr.roomOf(conn.token);
      const res = mgr.startGame(conn.token, room ? room.roomId : NaN);
      if (res.error) return replyError(res.error.code, res.error.message);
      return reply("game.started", {});
    }
    case "game.flip":
    case "game.replace":
    case "game.peek":
    case "game.swap":
    case "game.skip":
    case "game.settleContinue": {
      const res = mgr.gameAction(conn.token, type, payload);
      if (res.error) return replyError(res.error.code, res.error.message);
      return reply("action.ok", {});
    }
    case "session.check": {
      const found = mgr.checkSession(String(payload.token || ""));
      return reply("session.check.ok", { session: found });
    }
    case "reconnect": {
      const reqToken = String(payload.token || "");
      if (conn.token && conn.token !== reqToken) mgr.leave(conn.token);
      const res = mgr.reconnect(conn, reqToken);
      if (res.error) return replyError(res.error.code, res.error.message);
      conn.token = reqToken;
      return reply("reconnected", { room: mgr.roomState(res.room), yourSeat: res.seat });
    }
    default:
      return replyError("UNKNOWN_TYPE", "\u672A\u77E5\u6D88\u606F\u7C7B\u578B");
  }
}
function sanitizeName(name) {
  const s = String(name ?? "").replace(/[\u0000-\u001f\u202a-\u202e]/g, "").trim().slice(0, 12);
  return s || "\u73A9\u5BB6";
}
var entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entry && entry === import.meta.url) {
  const app = createServerApp(Number(process.env.PORT || readPort()));
  app.httpServer.listen(app.port, () => console.log(`[echo-array] server listening on :${app.port}\uFF08static: ${process.env.STATIC_DIR || "../dist/build/h5"}\uFF09`));
}
export {
  createServerApp
};
