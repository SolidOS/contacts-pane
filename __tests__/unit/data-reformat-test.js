"use strict";
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
var contactLogic_1 = require("../../contactLogic");
var jest_fetch_mock_1 = require("jest-fetch-mock");
var contactsPane_1 = require("../../contactsPane");
var rdflib_1 = require("rdflib");
var setup_1 = require("./setup");
// This was at testingsolidos.solidcommunity.net
var base = setup_1.doc.dir().uri;
var webid1 = setup_1.store.sym(base + 'People/localPerson/index.ttl#this');
var exampleData = setup_1.prefixes + "\n\n:homeGroup1 a vcard:Group;\n    vcard:fn \"Happy Home\";\n    vcard:hasMember ".concat(webid1, " .\n\n:homeGroup2 a vcard:Group;\n    vcard:fn \"Home\";\n    vcard:hasMember :localPerson.\n\n:homeGroup3 a vcard:Group;\n    vcard:fn \"Home\";\n    vcard:hasMember :localPerson.\n\n");
var book = setup_1.store.sym(base + 'book.ttl#this');
var aliceLocal = setup_1.store.sym(base + 'People/aaaaaaaaaa/index.ttl#this');
var aliceWebId = setup_1.store.sym('https://alice.example/card#me');
setup_1.web[aliceLocal.doc().uri] = "<#this> a vcard:Individual, schema:Person; vcard:fn \"Alice\".";
var bobLocal = setup_1.store.sym(base + 'People/bbbbbbbbbb/index.ttl#this');
var bobWebId = setup_1.store.sym('https://bob.example.net/#me');
setup_1.web[bobLocal.doc().uri] = "<#this> a vcard:Individual, schema:Person;\n   vcard:hasURL [ vcard:type vcard:WebId; vcard:value ".concat(bobWebId, " ];\n   vcard:fn \"Bob\".");
setup_1.web[base + 'book.ttl'] = "\n<#this> a vcard:AddressBook;\n    vcard:fn \"\"\"Contacts: Test address book\"\"\";\n    vcard:nameEmailIndex <people.ttl>;\n    vcard:groupIndex <groups.ttl>.\n";
setup_1.web[base + 'groups.ttl'] = "\n<Group/Test.ttl#this> a vcard:Group ;\n    vcard:fn \"Test group\".\n<Group/Home.ttl#this> a vcard:Group ;\n    vcard:fn \"Home group\".\n<Group/Work.ttl#this> a vcard:Group ;\n    vcard:fn \"Work group\".\n";
var testGroup = setup_1.store.sym(base + 'Group/Test.ttl#this');
setup_1.web[testGroup.doc().uri] = "\n<#this> a vcard:Group;\n    vcard:fn \"Test Group\";\n    vcard:hasMember ".concat(aliceLocal, " .\n#                    <https://alice.example/card#me>,\n#                    <../People/aaaaaaaaaa/index.ttl#this>,\n#                    <../People/bbbbbbbbbbb/index.ttl#this> .\n\n    ").concat(aliceLocal, " = ").concat(aliceWebId, " .\n");
var homeGroup = setup_1.store.sym(base + 'Group/Home.ttl#this');
setup_1.web[homeGroup.doc().uri] = "\n<#this> a vcard:Group;\n    vcard:fn \"Home Group\";\n    vcard:hasMember\n                    <../People/aaaaaaaaaa/index.ttl#this>,\n                    <../People/bbbbbbbbbb/index.ttl#this> .\n";
var workGroup = setup_1.store.sym(base + 'Group/Work.ttl#this');
setup_1.web[workGroup.doc().uri] = "\n<#this> a vcard:Group;\n    vcard:fn \"Work Group\";\n    vcard:hasMember\n        <https://alice.example/card#me>,\n        <https://bob.example/card#me>,\n        <https://charlie.example/card#me> .";
setup_1.web[base + 'People/aaaaaaaaaa/index.ttl'] = "\n    <#this> vcard:fn \"Alice\" .\n";
var groups = [testGroup, homeGroup, workGroup];
for (var uri in setup_1.web) {
    console.log("  parsing \"".concat(uri, "\"  (").concat(setup_1.web[uri].length, ")"));
    (0, rdflib_1.parse)(setup_1.prefixes + setup_1.web[uri], setup_1.store, uri);
}
describe("contacts-pane", function () {
    describe("returns right label", function () {
        beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                setup_1.store.removeDocument(setup_1.doc);
                return [2 /*return*/];
            });
        }); });
        /*
        if (t[ns.vcard('Individual').uri]) return 'Contact'
        if (t[ns.vcard('Organization').uri]) return 'contact'
        if (t[ns.foaf('Person').uri]) return 'Person'
        if (t[ns.schema('Person').uri]) return 'Person'
        if (t[ns.vcard('Group').uri]) return 'Group'
        if (t[ns.vcard('AddressBook').uri]) return 'Address book'
        */
        it("returns a good label contact if Organization", function () {
            var thing = setup_1.store.sym(base + 'thing1');
            setup_1.store.add(thing, setup_1.ns.rdf('type'), setup_1.ns.vcard('Organization'), setup_1.doc);
            expect(contactsPane_1["default"].label(thing, setup_1.context)).toEqual('contact');
        });
        it("returns a good label Contact for Individual", function () {
            var thing = setup_1.store.sym(base + 'thing2');
            setup_1.store.add(thing, setup_1.ns.rdf('type'), setup_1.ns.vcard('Individual'), setup_1.doc);
            expect(contactsPane_1["default"].label(thing, setup_1.context)).toEqual('Contact');
        });
        it("returns a good label Person if Person", function () {
            var thing = setup_1.store.sym(base + 'thing3');
            setup_1.store.add(thing, setup_1.ns.rdf('type'), setup_1.ns.schema('Person'), setup_1.doc);
            expect(contactsPane_1["default"].label(thing, setup_1.context)).toEqual('Person');
        });
        it("returns a good label Person if foaf:Person", function () {
            var thing = setup_1.store.sym(base + 'thing4');
            setup_1.store.add(thing, setup_1.ns.rdf('type'), setup_1.ns.foaf('Person'), setup_1.doc);
            expect(contactsPane_1["default"].label(thing, setup_1.context)).toEqual('Person');
        });
        it("returns a good label Group if Group", function () {
            var thing = setup_1.store.sym(base + 'thing5');
            setup_1.store.add(thing, setup_1.ns.rdf('type'), setup_1.ns.vcard('Group'), setup_1.doc);
            expect(contactsPane_1["default"].label(thing, setup_1.context)).toEqual('Group');
        });
        it("returns a good label AddressBook if AddressBook", function () {
            var thing = setup_1.store.sym(base + 'thing6');
            setup_1.store.add(thing, setup_1.ns.rdf('type'), setup_1.ns.vcard('AddressBook'), setup_1.doc);
            expect(contactsPane_1["default"].label(thing, setup_1.context)).toEqual('Address book');
        });
        it("returns a null label if not a person", function () {
            var thing = setup_1.store.sym(base + 'thing7');
            expect(contactsPane_1["default"].label(setup_1.store.sym('https://random.example.com/'), setup_1.context)).toEqual(null);
            // done()
        });
    }); // label tests
    describe("data format tests", function () {
        beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                setup_1.store.removeDocument(setup_1.doc);
                (0, rdflib_1.parse)(exampleData, setup_1.store, setup_1.doc.uri);
                jest_fetch_mock_1["default"].mockIf(/^https?.*$/, setup_1.mockFetchFunction);
                return [2 /*return*/];
            });
        }); });
        it("converts a bad format into a good one", function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, del, ins;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        expect(setup_1.store.the(testGroup, setup_1.ns.vcard('hasMember'), null, testGroup.doc())).toEqual(aliceLocal);
                        return [4 /*yield*/, (0, contactLogic_1.getDataModelIssues)(groups)];
                    case 1:
                        _a = _b.sent(), del = _a.del, ins = _a.ins;
                        expect(del.length).toEqual(1);
                        expect(ins.length).toEqual(1);
                        expect(del.toString()).toEqual('<https://janedoe.example/profile/Group/Test.ttl#this> <http://www.w3.org/2006/vcard/ns#hasMember> <https://janedoe.example/profile/People/aaaaaaaaaa/index.ttl#this> .');
                        expect(ins.toString()).toEqual('<https://janedoe.example/profile/Group/Test.ttl#this> <http://www.w3.org/2006/vcard/ns#hasMember> <https://alice.example/card#me> .');
                        return [2 /*return*/];
                }
            });
        }); });
    }); // data format tests
}); // all tests
