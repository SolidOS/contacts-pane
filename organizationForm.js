module.exports = `
#  Form to record episodes in a life f a person
#
#

@prefix : <#> .

@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
@prefix owl: <http://www.w3.org/2002/07/owl#>.
@prefix schema: <http://schema.org/>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix ui: <http://www.w3.org/ns/ui#>.
@prefix vcard: <http://www.w3.org/2006/vcard/ns#>.
@prefix : <#>.


# Ontology which may be useful


# @@
solid:InterestingOrganization owl:disjointUnionOf  (
# Airline - a Corpration
# Consortium - a Corporation or a NGO
 schema:Corporation
 schema:EducationalOrganization
# FundingScheme - eh?
 schema:GovernmentOrganization
# LibrarySystem
# LocalBusiness - Corporation
# MedicalOrganization - a Corporation or a NGO
 schema:NGO
 # NewsMediaOrganization - a Corporation or a NGO
schema:PerformingGroup # a band
schema:Project # like Solid
schema:SportsOrganization # a Team
 ) .


## Example:
<> :example {
<https://ruben.verborgh.org/resume/#mit-2018> a <http://schema.org/Role>, <http://schema.org/OrganizationRole>, <http://schema.org/EmployeeRole>, <http://purl.org/vocab/bio/0.1/Event>, <http://purl.org/vocab/bio/0.1/Employment>;
    <http://schema.org/name> "Research Affiliate"@en;
    <http://schema.org/roleName> "Research Affiliate"@en;
    <http://www.w3.org/2000/01/rdf-schema#label> "Research Affiliate"@en.
<http://dbpedia.org/resource/Massachusetts_Institute_of_Technology> a <http://schema.org/Organization>.
<https://ruben.verborgh.org/resume/#mit-2018> <http://purl.org/vocab/bio/0.1/employer> <http://dbpedia.org/resource/Massachusetts_Institute_of_Technology>.
<http://dbpedia.org/resource/Massachusetts_Institute_of_Technology> <http://xmlns.com/foaf/0.1/homepage> <https://www.mit.edu/>;
    <http://schema.org/name> "Massachusetts Institute of Technology"@en;
    <http://www.w3.org/2000/01/rdf-schema#label> "Massachusetts Institute of Technology"@en.
_:b3 a <http://www.w3.org/2006/time#ProperInterval>.
<https://ruben.verborgh.org/resume/#mit-2018> <http://purl.org/vocab/bio/0.1/eventInterval> _:b3.
_:b4 a <http://www.w3.org/2006/time#Instant>.
_:b3 <http://www.w3.org/2006/time#hasBeginning> _:b4.
_:b4 <http://www.w3.org/2006/time#inXSDDate> "2018-02-01"^^<http://www.w3.org/2001/XMLSchema#date>.
<https://ruben.verborgh.org/resume/#mit-2018> <http://schema.org/startDate> "2018-02-01"^^<http://www.w3.org/2001/XMLSchema#date>.

} .



  :OrganinizationForm a ui:Form; schema:name "Form for editing a role" ;
    ui:parts ( :roleNameField :instituteNameField :hopePageURIField :startDateField :endDateField ) .





  :instituteNameField
      a ui:SingleLineTextField ;
      ui:label "Intitute Name";
      ui:maxLength "200" ;
      ui:property schema:name ;
      ui:size "80" .

   :institteHomePage a ui:NamedNodeURIField;
      ui:property  schema:url . # @@ ??

    :initituteTypeField a ui:Classifier;
    ui:label "What sort of organization";
    ui:category solid:InterestingOrganization .


# ends
`
