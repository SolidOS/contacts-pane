module.exports = `
# Now hand-edited

@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
@prefix owl: <http://www.w3.org/2002/07/owl#>.
@prefix ui: <http://www.w3.org/ns/ui#>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.
@prefix : <#>.

# Ontology additions or interpretations needed for the form to work well

# The ontolgy file doesnt make them disjoint.  This makes the selctor be a choice.
vcard:TelephoneType   owl:disjointUnionOf ( vcard:Cell vcard:Home vcard:Work) .
vcard:Type   owl:disjointUnionOf (vcard:Home vcard:Work) . # for email

# Better field labels
vcard:Cell ui:label "mobile"@en . # app will imake nitial caps if nec
vcard:hasAddress ui:label "address"@en .
vcard:hasEmail ui:label "email"@en .
vcard:hasTelephone ui:label "phone"@en .

#  The forms themselves

<http://www.w3.org/2006/vcard/ns#Individual>
    ui:creationForm <#form1> .


<#form1>
    <http://purl.org/dc/elements/1.1/title> "Contact Details" ;
    a ui:Form ;
    ui:part
        <#fullNameField>,   <#roleField>,   <#fullNameFieldC>, <#addressesComment>, <#addresses>,
        <#emailComment>, <#eMails>,
        <#telephoneComment>, <#telephones>, <#noteComment>, <#noteField> ;
    ui:parts (
                <#fullNameField>  <#roleField> <#fullNameFieldC>
                 <#addressesComment> <#addresses>
                <#emailComment> <#eMails>
                <#telephoneComment> <#telephones> <#noteComment> <#noteField> ) .

    <#fullNameField>
        a <http://www.w3.org/ns/ui#SingleLineTextField> ;
        ui:label "Name";
        <http://www.w3.org/ns/ui#maxLength> "128" ;
        <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#fn> ;
        <http://www.w3.org/ns/ui#size> "40" .

    <#roleField>
        a <http://www.w3.org/ns/ui#SingleLineTextField> ;
        ui:suppressEmptyUneditable true;
        <http://www.w3.org/ns/ui#maxLength> "128" ;
        <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#role> ;
        <http://www.w3.org/ns/ui#size> "40" .

      <#fullNameFieldC>
          a <http://www.w3.org/ns/ui#SingleLineTextField> ;
          ui:suppressEmptyUneditable true;
          <http://www.w3.org/ns/ui#maxLength> "128" ;
          <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#organization-name> ;
          <http://www.w3.org/ns/ui#size> "40" .


<#addressesComment>
    a <http://www.w3.org/ns/ui#Comment> ;
    ui:suppressIfUneditable true;
    <http://www.w3.org/ns/ui#contents> "Address" .


<#addresses>
    <http://purl.org/dc/elements/1.1/title> "Address details" ;
    a <http://www.w3.org/ns/ui#Multiple> ;
    <http://www.w3.org/ns/ui#part> <#oneAddress> ;
    <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#hasAddress> .

<#oneAddress>
    a <http://www.w3.org/ns/ui#Group> ;
    <http://www.w3.org/ns/ui#parts> ( <#id1409437207443> <#id1409437292400> <#id1409437421996> <#id1409437467649> <#id1409437569420> <#id1409437646712> ).

<#id1409437207443>
    a <http://www.w3.org/ns/ui#SingleLineTextField> ;
    <http://www.w3.org/ns/ui#maxLength> "128" ;
    <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#street-address> ;
    <http://www.w3.org/ns/ui#size> "40" .

<#id1409437292400>
    a <http://www.w3.org/ns/ui#SingleLineTextField> ;
    <http://www.w3.org/ns/ui#maxLength> "128" ;
    <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#locality> ;
    <http://www.w3.org/ns/ui#size> "40" .

<#id1409437421996>
    a <http://www.w3.org/ns/ui#SingleLineTextField> ;
    <http://www.w3.org/ns/ui#maxLength> "25" ;
    <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#postal-code> ;
    <http://www.w3.org/ns/ui#size> "25" .

<#id1409437467649>
    a <http://www.w3.org/ns/ui#SingleLineTextField> ;
    <http://www.w3.org/ns/ui#maxLength> "128" ;
    <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#region> ;
    <http://www.w3.org/ns/ui#size> "40" .

<#id1409437569420>
    a <http://www.w3.org/ns/ui#SingleLineTextField> ;
    <http://www.w3.org/ns/ui#maxLength> "128" ;
    <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#country-name> ;
    <http://www.w3.org/ns/ui#size> "40" .

<#id1409437646712>
    a <http://www.w3.org/ns/ui#Classifier> ;
    <http://www.w3.org/ns/ui#from> rdf:Class ;
    <http://www.w3.org/ns/ui#property> <http://purl.org/dc/terms/type> .


##############################

<#emailComment>
    a <http://www.w3.org/ns/ui#Comment> ;
    ui:suppressIfUneditable true;

    <http://www.w3.org/ns/ui#contents> "Email" .


<#eMails>
    a <http://www.w3.org/ns/ui#Multiple> ;
    <http://www.w3.org/ns/ui#part> <#oneEMail> ;
    <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#hasEmail> .

<#oneEMail>
    a <http://www.w3.org/ns/ui#Group> ; # hint: side by side is good
    <http://www.w3.org/ns/ui#part> <#emailValue>, <#emailType> ;
    <http://www.w3.org/ns/ui#parts> ( <#emailType>  <#emailValue> ).

<#emailValue>
    a <http://www.w3.org/ns/ui#EmailField> ; ui:label "email";
    <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#value> ;
    <http://www.w3.org/ns/ui#size> "50" .

<#emailType>
    a <http://www.w3.org/ns/ui#Classifier> ;
    <http://www.w3.org/ns/ui#canMintNew> "0" ;
    <http://www.w3.org/ns/ui#category> <http://www.w3.org/2006/vcard/ns#Type> ;
    <http://www.w3.org/ns/ui#from> <http://www.w3.org/2006/vcard/ns#Type> ;
    <http://www.w3.org/ns/ui#property> <http://purl.org/dc/terms/type> .


##############################

<#telephoneComment>
    a <http://www.w3.org/ns/ui#Comment> ;
    ui:suppressIfUneditable true;
    <http://www.w3.org/ns/ui#contents> "Phones" .


<#telephones>
    a <http://www.w3.org/ns/ui#Multiple> ;
    <http://www.w3.org/ns/ui#part> <#onetelephone> ;
    <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#hasTelephone> .

<#onetelephone>
    a <http://www.w3.org/ns/ui#Group> ;
    <http://www.w3.org/ns/ui#part> <#telephoneValue>, <#telephoneType> ;
    <http://www.w3.org/ns/ui#parts> (  <#telephoneType> <#telephoneValue> ).

<#telephoneValue>
    a <http://www.w3.org/ns/ui#PhoneField> ;
    <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#value> ;
    <http://www.w3.org/ns/ui#size> "50" .

<#telephoneType>
    a <http://www.w3.org/ns/ui#Classifier> ;
    <http://www.w3.org/ns/ui#canMintNew> "0" ;
    <http://www.w3.org/ns/ui#category> <http://www.w3.org/2006/vcard/ns#TelephoneType> ;
    <http://www.w3.org/ns/ui#from> <http://www.w3.org/2006/vcard/ns#Type> ;
    <http://www.w3.org/ns/ui#property> <http://purl.org/dc/terms/type> .

##############################

<#noteComment>
    a <http://www.w3.org/ns/ui#Comment> ;
    ui:suppressIfUneditable true;
    <http://www.w3.org/ns/ui#contents> "General Notes" .

<#noteField>
    a <http://www.w3.org/ns/ui#MultiLineTextField> ;
    ui:suppressEmptyUneditable true;

    <http://www.w3.org/ns/ui#property> <http://www.w3.org/2006/vcard/ns#note> .
`
