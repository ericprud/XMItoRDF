# DDI4_PIM_canonical.json: ../doc/DDI4_PIM_canonical.xmi
# 	../bin/xmiToJson $< > $@

all: DDI_4-DR0.2-OWL.xml # DDI_4-DR0.2.shexj DDI_4-DR0.2.json

DDI_4-DR0.2.shexj DDI_4-DR0.2.json: ../doc/DDI4_PIM_canonical.xmi ddiPSM ../doc/uml-model.js ../doc/canonical-uml-xmi-parser.js
	$(DEBUG) ./ddiPSM --xmi $< --out DDI_4-DR0.2 --nestShapes

DDI_4-DR0.2-OWL.xml: DDI_4-DR0.2.shexj ../bin/shexTo ../lib/ShExTo.js DDI_4-DR0.2-packagesAndViews-OWL.xml
	$(DEBUG) ../bin/shexTo --to owl --json $< \
	  --prefix "package: http://lion.ddialliance.org/ddiobjects/" \
	  --prefix "ddi: http://ddi-alliance.org/ns/#" \
	  --prefix "owl: http://www.w3.org/2002/07/owl#" \
	  --prefix "xsd: http://www.w3.org/2001/XMLSchema#" \
	  --prefix "rdfs: http://www.w3.org/2000/01/rdf-schema#" \
	  --append DDI_4-DR0.2-packagesAndViews-OWL.xml > $@

.DELETE_ON_ERROR:

