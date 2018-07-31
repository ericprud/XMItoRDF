# DDI4_PIM_canonical.json: ../doc/DDI4_PIM_canonical.xmi
# 	../bin/xmiToJson $< > $@

VALIDATE ?= ~/checkouts/shexSpec/shex.js/bin/validate

all: DDI_4-DR0.2.shex DDI_4-DR0.2-nested.shex DDI_4-DR0.2-nested.html DDI_4-DR0.2-nested.js DDI_4-DR0.2-OWL.xml # DDI_4-DR0.2.shexj DDI_4-DR0.2.json

DDI_4-DR0.2.shexj DDI_4-DR0.2-nested.shexj DDI_4-DR0.2.json: ../doc/DDI4_PIM_canonical.xmi ddiPSM ../doc/uml-model.js ../doc/canonical-uml-xmi-parser.js
	$(DEBUG) ./ddiPSM --xmi $< --out DDI_4-DR0.2 --nestShapes

DDI_4-DR0.2-nested.js: DDI_4-DR0.2-nested.shexj
	(echo -n 'DDIschema = ' && cat $<) > $@

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

DI: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdDDIMetadata:1_DocumentInformation" , "shape": "http://ddi-alliance.org/ns/#DocumentInformation" }]'

Study: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdStudy:1_Study" , "shape": "http://ddi-alliance.org/ns/#Study" }]'

Access: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdStudyAccess:1_Access" , "shape": "http://ddi-alliance.org/ns/#Access" }]'

Coverage: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdCoverage:1_Coverage" , "shape": "http://ddi-alliance.org/ns/#Coverage" }]'

SpatialCoverage: DDI_4-DR0.2.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2.shex --map '[{ "node": "#urn:ddi:int.example:IdSpatialCoverage:1_SpatialCoverage" , "shape": "http://ddi-alliance.org/ns/#SpatialCoverage" }]'

UnitType: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdNationUnit:1_UnitType" , "shape": "http://ddi-alliance.org/ns/#UnitType" }]'

GeographicUnit: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:GeoUnit_1:1_GeographicUnit" , "shape": "http://ddi-alliance.org/ns/#GeographicUnit" }]'

TemporalCoverage: DDI_4-DR0.2.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2.shex --map '[{ "node": "#urn:ddi:int.example:IdTemporalCoverage:1_TemporalCoverage" , "shape": "http://ddi-alliance.org/ns/#TemporalCoverage" }]'

TopicalCoverage: DDI_4-DR0.2.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2.shex --map '[{ "node": "#urn:ddi:int.example:IdTopicalCoverage:1_TopicalCoverage" , "shape": "http://ddi-alliance.org/ns/#TopicalCoverage" }]'

Individual: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdBean:1_Individual" , "shape": "http://ddi-alliance.org/ns/#Individual" },{ "node": "#urn:ddi:int.example:IdMcAllister:1_Individual" , "shape": "http://ddi-alliance.org/ns/#Individual" },{ "node": "#urn:ddi:int.example:IdPietsch:1_Individual" , "shape": "http://ddi-alliance.org/ns/#Individual" },{ "node": "#urn:ddi:int.example:IdGibson:1_Individual" , "shape": "http://ddi-alliance.org/ns/#Individual" }]'

Organization: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdOrgARC:1_Organization" , "shape": "http://ddi-alliance.org/ns/#Organization" },{ "node": "#urn:ddi:int.example:IdOrgSRC:1_Organization" , "shape": "http://ddi-alliance.org/ns/#Organization" },{ "node": "#urn:ddi:int.example:IdOrgADA:1_Organization" , "shape": "http://ddi-alliance.org/ns/#Organization" }]'

FundingInformation: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdFunding:1_FundingInformation" , "shape": "http://ddi-alliance.org/ns/#FundingInformation" }]'

MethodologyOverview: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdWeighting:1_MethodologyOverview" , "shape": "http://ddi-alliance.org/ns/#MethodologyOverview" },{ "node": "#urn:ddi:int.example:IdDataCollection:1_MethodologyOverview" , "shape": "http://ddi-alliance.org/ns/#MethodologyOverview" },{ "node": "#urn:ddi:int.example:IdSampling:1_MethodologyOverview" , "shape": "http://ddi-alliance.org/ns/#MethodologyOverview" },{ "node": "#urn:ddi:int.example:IdDataProcessing:1_MethodologyOverview" , "shape": "http://ddi-alliance.org/ns/#MethodologyOverview" }]'

InstanceVariable: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdVarDivisNum:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarUniqueID:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarMode:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarDateComp:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarState:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarDivision:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarA4:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarG1Age:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarXg5:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarWeight:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarPartyAby:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarSwingn:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" }]'

VariableCollection: DDI_4-DR0.2.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2.shex --map '[{ "node": "#urn:ddi:int.example:IdVarGrpAdmim:1_VariableCollection" , "shape": "http://ddi-alliance.org/ns/#VariableCollection" },{ "node": "#urn:ddi:int.example:IdVarGrpCampaign:1_VariableCollection" , "shape": "http://ddi-alliance.org/ns/#VariableCollection" },{ "node": "#urn:ddi:int.example:IdVarGrpEduc:1_VariableCollection" , "shape": "http://ddi-alliance.org/ns/#VariableCollection" },{ "node": "#urn:ddi:int.example:IdVarGrpWeight:1_VariableCollection" , "shape": "http://ddi-alliance.org/ns/#VariableCollection" },{ "node": "#urn:ddi:int.example:IdVarGrpResults:1_VariableCollection" , "shape": "http://ddi-alliance.org/ns/#VariableCollection" }]'

ValueMapping: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IDVmVarDivisNum:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarUniqueID:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarMode:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarDateComp:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarState:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarDivision:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarA4:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarG1Age:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarXg5:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarWeight:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarPartyAby:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarSwingn:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" }]'

DataPoint: DDI_4-DR0.2-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x DDI_4-DR0.2-nested.shex --map '[{ "node": "#urn:ddi:int.example:IDDptVarDivisNum:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptVarUniqueID:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptMode:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptDateComp:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptState:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptDivision:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptA4:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptG1Age:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptXg5:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptWeight:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptPartyAby:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptSwingn:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" }]'

testOZ: DI Study Access Coverage SpatialCoverage UnitType GeographicUnit TemporalCoverage TopicalCoverage Individual Organization FundingInformation MethodologyOverview InstanceVariable VariableCollection ValueMapping DataPoint

.DELETE_ON_ERROR:

