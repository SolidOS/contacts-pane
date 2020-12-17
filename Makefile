# Wrap TTL files into JS files for bundling with library

,all : individualForm.js vcard.js organizationForm.js autocompletePicker.js

individualForm.js : individualForm.ttl
				(echo 'module.exports = `' ; cat individualForm.ttl; echo '`') >  individualForm.js

organizationForm.js : organizationForm.ttl
				(echo 'module.exports = `' ; cat organizationForm.ttl; echo '`') >  organizationForm.js

vcard.ttl:
				curl  http://www.w3.org/2006/vcard/ns > vcard.ttl

vcard.js : vcard.ttl
				(echo 'module.exports = `' ; cat vcard.ttl; echo '`') >  vcard.js

autocompletePicker.js: autocompletePicker.ts
				npx tsc autocompletePicker.ts
