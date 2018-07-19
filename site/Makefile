# DDI4_PIM_canonical.json: ../doc/DDI4_PIM_canonical.xmi
# 	../bin/xmiToJson $< > $@

all: DDI_4-DR0.2-OWL.xml # DDI_4-DR0.2.shexj DDI_4-DR0.2.json

DDI_4-DR0.2.shexj DDI_4-DR0.2.json: ../doc/DDI4_PIM_canonical.xmi ddiPSM ../doc/uml-model.js ../doc/canonical-uml-xmi-parser.js
	$(DEBUG) ./ddiPSM --xmi $< --out DDI_4-DR0.2

DDI_4-DR0.2-OWL.xml: DDI_4-DR0.2.shexj ../bin/shexToOwl ../lib/ShExToOwl.js DDI_4-DR0.2-packagesAndViews-OWL.xml
	$(DEBUG) ../bin/shexToOwl --json $< \
	--prefix "package: http://lion.ddialliance.org/ddiobjects/" \
	--prefix "ddi: http://ddi-alliance.org/ns/#" \
	--prefix "xsd: http://www.w3.org/2001/XMLSchema#" \
	--append DDI_4-DR0.2-packagesAndViews-OWL.xml > $@

.DELETE_ON_ERROR:

