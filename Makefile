# Wrap TTL files into JS files for bundling with library

,all : dist/individualForms.js dist/vcard.js dist/instituteDetailsQuery.js dist/organizationForm.js

dist/individualForms.js : src/forms.ttl
				(echo 'module.exports = `' ; cat $< ; echo '`') > $@

src/vcard.ttl:
				curl  http://www.w3.org/2006/vcard/ns > src/vcard.ttl

dist/vcard.js : src/vcard.ttl
				(echo 'module.exports = `' ; cat $< ; echo '`') >  $@


dist/instituteDetailsQuery.js : src/instituteDetailsQuery.sparql
				(echo 'module.exports = `' ; cat $< ; echo '`') >  $@

dist/organizationForm.js : src/organizationForm.ttl
				(echo 'module.exports = `' ; cat $< ; echo '`') >  $@
