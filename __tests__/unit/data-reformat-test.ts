import { getDataModelIssues } from '../../contactLogic'
import fetchMock from "jest-fetch-mock";

import pane from "../../contactsPane";
import { parse, NamedNode } from "rdflib";
import { context, doc, subject, mockFetchFunction, ns, store, prefixes, web } from "./setup";

// This was at testingsolidos.solidcommunity.net

const base = doc.dir().uri
const webid1 = store.sym(base + 'People/localPerson/index.ttl#this')

const exampleData = prefixes + `

:homeGroup1 a vcard:Group;
    vcard:fn "Happy Home";
    vcard:hasMember ${webid1} .

:homeGroup2 a vcard:Group;
    vcard:fn "Home";
    vcard:hasMember :localPerson.

:homeGroup3 a vcard:Group;
    vcard:fn "Home";
    vcard:hasMember :localPerson.

`

const book = store.sym(base + 'book.ttl#this')

const aliceLocal = store.sym(base + 'People/aaaaaaaaaa/index.ttl#this');
const aliceWebId = store.sym('https://alice.example/card#me')

web[aliceLocal.doc().uri] = `<#this> a vcard:Individual, schema:Person; vcard:fn "Alice".`;

const bobLocal = store.sym(base + 'People/bbbbbbbbbb/index.ttl#this')
const bobWebId = store.sym('https://bob.example.net/#me')
web[bobLocal.doc().uri] = `<#this> a vcard:Individual, schema:Person;
   vcard:hasURL [ vcard:type vcard:WebId; vcard:value ${bobWebId} ];
   vcard:fn "Bob".`;



web[base + 'book.ttl'] =  `
<#this> a vcard:AddressBook;
    vcard:fn """Contacts: Test address book""";
    vcard:nameEmailIndex <people.ttl>;
    vcard:groupIndex <groups.ttl>.
`;

web[base + 'groups.ttl'] = `
<Group/Test.ttl#this> a vcard:Group ;
    vcard:fn "Test group".
<Group/Home.ttl#this> a vcard:Group ;
    vcard:fn "Home group".
<Group/Work.ttl#this> a vcard:Group ;
    vcard:fn "Work group".
`;

const testGroup = store.sym(base + 'Group/Test.ttl#this')
web[testGroup.doc().uri] = `
<#this> a vcard:Group;
    vcard:fn "Test Group";
    vcard:hasMember ${aliceLocal} .
#                    <https://alice.example/card#me>,
#                    <../People/aaaaaaaaaa/index.ttl#this>,
#                    <../People/bbbbbbbbbbb/index.ttl#this> .

    ${aliceLocal} = ${aliceWebId} .
`;
const homeGroup = store.sym(base + 'Group/Home.ttl#this')
web[homeGroup.doc().uri] = `
<#this> a vcard:Group;
    vcard:fn "Home Group";
    vcard:hasMember
                    <../People/aaaaaaaaaa/index.ttl#this>,
                    <../People/bbbbbbbbbb/index.ttl#this> .
`;

const workGroup = store.sym(base + 'Group/Work.ttl#this')
web[workGroup.doc().uri] = `
<#this> a vcard:Group;
    vcard:fn "Work Group";
    vcard:hasMember
        <https://alice.example/card#me>,
        <https://bob.example/card#me>,
        <https://charlie.example/card#me> .`;

web[base + 'People/aaaaaaaaaa/index.ttl'] = `
    <#this> vcard:fn "Alice" .
`;

const groups = [ testGroup, homeGroup, workGroup ];

for (const uri in web) {
  console.log(`  parsing "${uri}"  (${web[uri].length})`)
  parse(prefixes + web[uri], store, uri);
}

describe("contacts-pane", () => {

  describe("returns right label", () => {
    beforeAll(async () => {
      store.removeDocument(doc);
      // parse(exampleData, store, doc.uri);
      // const label = pane.label(subject, context);
    });
/*
if (t[ns.vcard('Individual').uri]) return 'Contact'
if (t[ns.vcard('Organization').uri]) return 'contact'
if (t[ns.foaf('Person').uri]) return 'Person'
if (t[ns.schema('Person').uri]) return 'Person'
if (t[ns.vcard('Group').uri]) return 'Group'
if (t[ns.vcard('AddressBook').uri]) return 'Address book'
*/
  it("returns a good label contact if Organization", () => {
    let thing = store.sym(base + 'thing1')
    store.add(thing, ns.rdf('type'),  ns.vcard('Organization'), doc)
    expect(pane.label(thing, context)).toEqual('contact');

  });
  it("returns a good label Contact for Individual", () => {
    let thing = store.sym(base + 'thing2')
    store.add(thing, ns.rdf('type'),  ns.vcard('Individual'), doc)
    expect(pane.label(thing, context)).toEqual('Contact');
  });
  it("returns a good label Person if Person", () => {
    let thing = store.sym(base + 'thing3')
    store.add(thing, ns.rdf('type'),  ns.schema('Person'), doc)
    expect(pane.label(thing, context)).toEqual('Person');
  });
  it("returns a good label Person if foaf:Person", () => {
    let thing = store.sym(base + 'thing4')
    store.add(thing, ns.rdf('type'),  ns.foaf('Person'), doc)
    expect(pane.label(thing, context)).toEqual('Person');
  });
  it("returns a good label Group if Group", () => {
    let thing = store.sym(base + 'thing5')

    store.add(thing, ns.rdf('type'),  ns.vcard('Group'), doc)
    expect(pane.label(thing, context)).toEqual('Group');
  });
  it("returns a good label AddressBook if AddressBook", () => {
    let thing = store.sym(base + 'thing6')
    store.add(thing, ns.rdf('type'),  ns.vcard('AddressBook'), doc)
    expect(pane.label(thing, context)).toEqual('Address book');
  });
    it("returns a null label if not a person", () => {
      let thing = store.sym(base + 'thing7')
      expect(pane.label(store.sym('https://random.example.com/'), context)).toEqual(null);
      // done()
    });

  }); // label tests


  describe("data format tests", () => {
    beforeAll(async () => {
      store.removeDocument(doc);
      parse(exampleData, store, doc.uri);
      fetchMock.mockIf(/^https?.*$/, mockFetchFunction)
    });

    it("converts a bad format into a good one", async () => {
      expect(store.the(testGroup, ns.vcard('hasMember'), null, testGroup.doc())).toEqual(aliceLocal)
      const { del, ins } = await getDataModelIssues(groups)
      expect(del.length).toEqual(1)
      expect(ins.length).toEqual(1)
      expect(del.toString()).toEqual('<https://janedoe.example/profile/Group/Test.ttl#this> <http://www.w3.org/2006/vcard/ns#hasMember> <https://janedoe.example/profile/People/aaaaaaaaaa/index.ttl#this> .')
      expect(ins.toString()).toEqual('<https://janedoe.example/profile/Group/Test.ttl#this> <http://www.w3.org/2006/vcard/ns#hasMember> <https://alice.example/card#me> .')
    });

  }); // data format tests

}); // all tests
