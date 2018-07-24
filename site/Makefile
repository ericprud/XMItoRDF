# DDI4_PIM_canonical.json: ../doc/DDI4_PIM_canonical.xmi
# 	../bin/xmiToJson $< > $@

all: DDI_4-DR0.2-nested.shex DDI_4-DR0.2-nested.html DDI_4-DR0.2-OWL.xml # DDI_4-DR0.2.shexj DDI_4-DR0.2.json

DDI_4-DR0.2.shexj DDI_4-DR0.2-nested.shexj DDI_4-DR0.2.json: ../doc/DDI4_PIM_canonical.xmi ddiPSM ../doc/uml-model.js ../doc/canonical-uml-xmi-parser.js
	$(DEBUG) ./ddiPSM --xmi $< --out DDI_4-DR0.2 --nestShapes

DDI_4-DR0.2-OWL.xml: DDI_4-DR0.2.shexj ../bin/shexTo ../lib/ShExTo.js DDI_4-DR0.2-packagesAndViews-OWL.xml
	$(DEBUG) ../bin/shexTo --to owl --json $< \
	  --prefix "package: http://lion.ddialliance.org/ddiobjects/" \
	  --prefix "ddi: http://ddi-alliance.org/ns/#" \
	  --prefix "owl: http://www.w3.org/2002/07/owl#" \
	  --prefix "xsd: http://www.w3.org/2001/XMLSchema#" \
	  --prefix "rdfs: http://www.w3.org/2000/01/rdf-schema#" \
	  --append DDI_4-DR0.2-packagesAndViews-OWL.xml > $@

DDI_4-DR0.2.shex: DDI_4-DR0.2.shexj ../bin/shexTo ../lib/ShExTo.js
	$(DEBUG) ../bin/shexTo --to shexc --json $< \
	  --prefix "ddi: http://ddi-alliance.org/ns/#" \
	  --prefix "owl: http://www.w3.org/2002/07/owl#" \
	  --prefix "xsd: http://www.w3.org/2001/XMLSchema#" \
	  --prefix "rdfs: http://www.w3.org/2000/01/rdf-schema#" \
	  --prefix "shexmi: http://www.w3.org/ns/shex-xmi#" \
	  --prefix "mark: https://github.com/commonmark/commonmark.js" > $@

DDI_4-DR0.2-nested.shex: DDI_4-DR0.2-nested.shexj ../bin/shexTo ../lib/ShExTo.js
	$(DEBUG) ../bin/shexTo --to shexc --json $< \
	  --prefix "ddi: http://ddi-alliance.org/ns/#" \
	  --prefix "owl: http://www.w3.org/2002/07/owl#" \
	  --prefix "xsd: http://www.w3.org/2001/XMLSchema#" \
	  --prefix "rdfs: http://www.w3.org/2000/01/rdf-schema#" \
	  --prefix "shexmi: http://www.w3.org/ns/shex-xmi#" \
	  --prefix "mark: https://github.com/commonmark/commonmark.js" > $@

DDI_4-DR0.2-nested.html: DDI_4-DR0.2-nested.shexj ../bin/shexTo ../lib/ShExTo.js
	$(DEBUG) ../bin/shexTo --to shexh --json $< \
	  --prefix "ddi: http://ddi-alliance.org/ns/#" \
	  --prefix "owl: http://www.w3.org/2002/07/owl#" \
	  --prefix "xsd: http://www.w3.org/2001/XMLSchema#" \
	  --prefix "rdfs: http://www.w3.org/2000/01/rdf-schema#" \
	  --prefix "shexmi: http://www.w3.org/ns/shex-xmi#" \
	  --prefix "mark: https://github.com/commonmark/commonmark.js" > $@

.DELETE_ON_ERROR:

