module.exports = `
# Now hand-edited

@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
@prefix dct: <http://purl.org/dc/terms/>.
@prefix owl: <http://www.w3.org/2002/07/owl#>.
@prefix ui: <http://www.w3.org/ns/ui#>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.
@prefix : <#>.

# Ontology additions or interpretations needed for the form to work well

# The ontology file doesn't make them disjoint.  This makes the selector be a choice.
vcard:TelephoneType   owl:disjointUnionOf ( vcard:Cell vcard:Home vcard:Work) .
vcard:Type   owl:disjointUnionOf (vcard:Home vcard:Work) . # for email

# Better field labels
vcard:Cell ui:label "mobile"@en . # app will imake nitial caps if nec
vcard:hasAddress ui:label "address"@en .
vcard:bday ui:label "born"@en.
vcard:hasEmail ui:label "email"@en .
vcard:hasTelephone ui:label "phone"@en .
vcard:note ui:label "notes"@en .

#  The forms themselves

vcard:Individual
    ui:creationForm :form1 .

# The addressComment, etc., fields with a comment before each type of field
# were originally partly because the labels on the fields were clumsy like "hasAddress".
# This is fixed by adding the ui:label to the properties above, so let's try
# removing the little micro-headings

:form1
    dct:title "Contact Details" ;
    a ui:Form ;
    ui:part
        :fullNameField,   :roleField,   :fullNameFieldC, :addressesComment, :addresses,
        :emailComment, :eMails,
        :telephoneComment, :telephones, :noteComment, :noteField ;
    ui:parts (
                :fullNameField  :roleField :fullNameFieldC
                # :addressesComment
                  :addresses
                # :emailComment
                 :eMails
                # :telephoneComment
                 :telephones  :birthdayField
                 # :noteComment
                  :noteField ) .

    :fullNameField
        a ui:SingleLineTextField ;
        ui:label "Name";
        ui:maxLength "128" ;
        ui:property vcard:fn ;
        ui:size "40" .

    :roleField
        a ui:SingleLineTextField ;
        ui:suppressEmptyUneditable true;
        ui:maxLength "128" ;
        ui:property vcard:role ;
        ui:size "40" .

      :fullNameFieldC
          a ui:SingleLineTextField ;
          ui:suppressEmptyUneditable true;
          ui:maxLength "128" ;
          ui:property vcard:organization-name ;
          ui:size "40" .

      :paymentPointerField
          a ui:SingleLineTextField ;
          ui:maxLength "128" ;
          ui#property <http://paymentpointers.org/ns#PaymentPointer> ;
          ui#size "40" .

:addressesComment
    a ui:Comment ;
    ui:suppressIfUneditable true;
    ui:contents "Address" .


:addresses
    dct:title "Address details" ;
    a ui:Multiple ;
    ui:part :oneAddress ;
    ui:property vcard:hasAddress .

:oneAddress
    a ui:Group ;
    ui:parts ( :id1409437207443 :id1409437292400 :id1409437421996 :id1409437467649 :id1409437569420 :id1409437646712 ).

:id1409437207443
    a ui:SingleLineTextField ;
    ui:maxLength "128" ;
    ui:property vcard:street-address ;
    ui:size "40" .

:id1409437292400
    a ui:SingleLineTextField ;
    ui:maxLength "128" ;
    ui:property vcard:locality ;
    ui:size "40" .

:id1409437421996
    a ui:SingleLineTextField ;
    ui:maxLength "25" ;
    ui:property vcard:postal-code ;
    ui:size "25" .

:id1409437467649
    a ui:SingleLineTextField ;
    ui:maxLength "128" ;
    ui:property vcard:region ;
    ui:size "40" .

:id1409437569420
    a ui:SingleLineTextField ;
    ui:maxLength "128" ;
    ui:property vcard:country-name ;
    ui:size "40" .

:id1409437646712
    a ui:Classifier ;
    ui:from rdf:Class ;
    ui:property rdf:type .


##############################

:emailComment
    a ui:Comment ;
    ui:suppressIfUneditable true;

    ui:contents "Email" .


:eMails
    a ui:Multiple ;
    ui:part :oneEMail ;
    ui:property vcard:hasEmail .

:oneEMail
    a ui:Group ; # hint: side by side is good
    ui:part :emailValue, :emailType ;
    ui:parts ( :emailType  :emailValue ).

:emailValue
    a ui:EmailField ; ui:label "email";
    ui:property vcard:value ;
    ui:size "50" .

:emailType
    a ui:Classifier ;
    ui:canMintNew "0" ;
    ui:category vcard:Type ;
    ui:from vcard:Type ;
    ui:property rdf:type .


##############################

:telephoneComment
    a ui:Comment ;
    ui:suppressIfUneditable true;
    ui:contents "Phones" .


:telephones
    a ui:Multiple ;
    ui:part :onetelephone ;
    ui:property vcard:hasTelephone .

:onetelephone
    a ui:Group ;
    ui:part :telephoneValue, :telephoneType ;
    ui:parts (  :telephoneType :telephoneValue ).

:telephoneValue
    a ui:PhoneField ;
    ui:property vcard:value ;
    ui:size "50" .

:telephoneType
    a ui:Classifier ;
    ui:canMintNew "0" ;
    ui:category vcard:TelephoneType ;
    ui:from vcard:Type ;
    ui:property rdf:type .

##############################

:birthdayField
    a ui:DateField;
    ui:label "Born";
    ui:suppressEmptyUneditable true;
    ui:property vcard:bday .

##############################

:noteComment
    a ui:Comment ;
    ui:suppressIfUneditable true;
    ui:contents "General Notes" .

:noteField
    a ui:MultiLineTextField ;
    ui:suppressEmptyUneditable true;

    ui:property vcard:note .
`
