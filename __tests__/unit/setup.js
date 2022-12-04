"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.mockFetchFunction = exports.requests = exports.web = exports.prefixes = exports.context = exports.doc = exports.subject = exports.rdf = exports.store = exports.ns = void 0;
// export { sym} from "rdflib";
var solid_ui_1 = require("solid-ui");
var solid_ui_2 = require("solid-ui");
__createBinding(exports, solid_ui_2, "ns");
__createBinding(exports, solid_ui_2, "store");
__createBinding(exports, solid_ui_2, "rdf");
// console.log('@@ store', store)
// console.log('@@ store.sym', store.sym)
exports.subject = solid_ui_1.store.sym("https://janedoe.example/profile/card#me");
exports.doc = exports.subject.doc();
exports.context = {
    dom: document,
    getOutliner: function () { return null; },
    session: {
        paneRegistry: {
            byName: function (name) {
                return {
                    render: function () {
                        return document.createElement('div')
                            .appendChild(document.createTextNode("mock ".concat(name, " pane")));
                    }
                };
            }
        },
        store: solid_ui_1.store,
        logic: {}
    }
};
/*
const foo = ns.rdf('type')
console.log('ns: ' + ns)
console.log('Object.keys(ns): ', Object.keys(ns))
console.log('Object.keys(ns)[0]: ', Object.keys(ns)[0])
console.log('ns[Object.keys(ns)[0]]: ', ns[Object.keys(ns)[0]])
console.log('ns[Object.keys(ns)[0]]("foo"): ', ns[Object.keys(ns)[0]]('foo'))
console.log(" ns['default']:", ns['default'])
*/
var prefs = Object.keys(solid_ui_1.ns).filter(function (x) { return x !== 'default'; }); // default is bogus value
exports.prefixes = prefs.map(function (prefix) { return "@prefix ".concat(prefix, ": ").concat(solid_ui_1.ns[prefix](''), ".\n"); }).join(''); // In turtle
exports.web = {};
exports.requests = [];
function mockFetchFunction(req) {
    return __awaiter(this, void 0, void 0, function () {
        var contents_1, contents;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(req.method !== 'GET')) return [3 /*break*/, 3];
                    exports.requests.push(req);
                    if (!(req.method === 'PUT')) return [3 /*break*/, 2];
                    return [4 /*yield*/, req.text()];
                case 1:
                    contents_1 = _a.sent();
                    exports.web[req.url] = contents_1; // Update our dummy web
                    console.log("Tetst: Updated ".concat(req.url, " on PUT to <<<").concat(exports.web[req.url], ">>>"));
                    _a.label = 2;
                case 2: return [2 /*return*/, { status: 200 }];
                case 3:
                    contents = exports.web[req.url];
                    if (contents !== undefined) { //
                        return [2 /*return*/, {
                                body: exports.prefixes + contents,
                                status: 200,
                                headers: {
                                    "Content-Type": "text/turtle",
                                    "WAC-Allow": 'user="write", public="read"',
                                    "Accept-Patch": "application/sparql-update"
                                }
                            }];
                    } // if contents
                    return [2 /*return*/, {
                            status: 404,
                            body: 'Not Found'
                        }];
            }
        });
    });
}
exports.mockFetchFunction = mockFetchFunction;
