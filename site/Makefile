# DDI_Core_-_Master_2019-12-19_CX.json: ../doc/DDI_Core_-_Master_2019-12-19_CX.xmi
# 	../bin/xmiToJson $< > $@

# XMI = ../doc/DDI4_PIM_canonical.xmi
# OUT = DDI_4-DR0.2
XMI = ../doc/DDI_Core_-_Master_2019-12-11_v2_CX.xmi
OUT = DDICore_40_PIM
VALIDATE ?= ../node_modules/.bin/shex-validate -q

# Remember to \-escape '#'s in the prefixes.
CORE_PREFIXES = \
	  --prefix "ddi: http://ddi-alliance.org/ns/\#" \
	  --prefix "owl: http://www.w3.org/2002/07/owl\#" \
	  --prefix "xsd: http://www.w3.org/2001/XMLSchema\#" \
	  --prefix "rdfs: http://www.w3.org/2000/01/rdf-schema\#"

SHEX_PREFIXES = $(CORE_PREFIXES) \
	  --prefix "shexmi: http://www.w3.org/ns/shex-xmi\#" \
	  --prefix "mark: https://github.com/commonmark/commonmark.js"

OWL_PREFIXES =  \
	  --prefix "package: http://lion.ddialliance.org/ddiobjects/" \
	  $(CORE_PREFIXES)

all: $(OUT).shex $(OUT)-nested.shex $(OUT)-nested.html $(OUT)-nested.js $(OUT)-OWL.xml # $(OUT).shexj $(OUT).json

clean:
	rm -f $(OUT).shex $(OUT)-nested.shex $(OUT)-nested.html $(OUT)-nested.js $(OUT)-OWL.xml

$(OUT).shexj $(OUT)-nested.shexj $(OUT).json: $(XMI) ddiPSM ../node_modules/uml-model/uml-model.js ../node_modules/canonical-uml-xmi-parser/canonical-uml-xmi-parser.js
	$(DEBUG) ./ddiPSM --xmi $< --out $(OUT) --nestShapes --noNest='SpatialCoverage|TemporalCoverage|TopicalCoverage|VariableCollection|Represented(Measurement|Question)'

$(OUT)-nested.js: $(OUT)-nested.shexj
	(echo -n 'DDIschema = ' && cat $<) > $@

$(OUT)-OWL.xml: $(OUT).shexj ../bin/shexTo ../lib/ShExTo.js $(OUT)-packagesAndViews-OWL.xml
	$(DEBUG) ../bin/shexTo --to owl --json $< $(OWL_PREFIXES) \
	  --append $(OUT)-packagesAndViews-OWL.xml > $@

$(OUT).shex: $(OUT).shexj ../bin/shexTo ../lib/ShExTo.js
	$(DEBUG) ../bin/shexTo --to shexc --json $< $(SHEX_PREFIXES) > $@

$(OUT)-nested.shex: $(OUT)-nested.shexj ../bin/shexTo ../lib/ShExTo.js
	$(DEBUG) ../bin/shexTo --to shexc --json $< $(SHEX_PREFIXES) > $@

$(OUT)-nested.html: $(OUT)-nested.shexj ../bin/shexTo ../lib/ShExTo.js
	$(DEBUG) ../bin/shexTo --to shexh --json $< $(SHEX_PREFIXES) > $@

DI: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdDDIMetadata:1_DocumentInformation" , "shape": "http://ddi-alliance.org/ns/#DocumentInformation" }]'

Study: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdStudy:1_Study" , "shape": "http://ddi-alliance.org/ns/#Study" }]'

Access: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdStudyAccess:1_Access" , "shape": "http://ddi-alliance.org/ns/#Access" }]'

Coverage: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdCoverage:1_Coverage" , "shape": "http://ddi-alliance.org/ns/#Coverage" }]'

SpatialCoverage: $(OUT).shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT).shex --map '[{ "node": "#urn:ddi:int.example:IdSpatialCoverage:1_SpatialCoverage" , "shape": "http://ddi-alliance.org/ns/#SpatialCoverage" }]'

UnitType: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdNationUnit:1_UnitType" , "shape": "http://ddi-alliance.org/ns/#UnitType" }]'

GeographicUnit: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:GeoUnit_1:1_GeographicUnit" , "shape": "http://ddi-alliance.org/ns/#GeographicUnit" }]'

TemporalCoverage: $(OUT).shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT).shex --map '[{ "node": "#urn:ddi:int.example:IdTemporalCoverage:1_TemporalCoverage" , "shape": "http://ddi-alliance.org/ns/#TemporalCoverage" }]'

TopicalCoverage: $(OUT).shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT).shex --map '[{ "node": "#urn:ddi:int.example:IdTopicalCoverage:1_TopicalCoverage" , "shape": "http://ddi-alliance.org/ns/#TopicalCoverage" }]'

Individual: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdBean:1_Individual" , "shape": "http://ddi-alliance.org/ns/#Individual" },{ "node": "#urn:ddi:int.example:IdMcAllister:1_Individual" , "shape": "http://ddi-alliance.org/ns/#Individual" },{ "node": "#urn:ddi:int.example:IdPietsch:1_Individual" , "shape": "http://ddi-alliance.org/ns/#Individual" },{ "node": "#urn:ddi:int.example:IdGibson:1_Individual" , "shape": "http://ddi-alliance.org/ns/#Individual" }]'

Organization: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdOrgARC:1_Organization" , "shape": "http://ddi-alliance.org/ns/#Organization" },{ "node": "#urn:ddi:int.example:IdOrgSRC:1_Organization" , "shape": "http://ddi-alliance.org/ns/#Organization" },{ "node": "#urn:ddi:int.example:IdOrgADA:1_Organization" , "shape": "http://ddi-alliance.org/ns/#Organization" }]'

FundingInformation: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdFunding:1_FundingInformation" , "shape": "http://ddi-alliance.org/ns/#FundingInformation" }]'

MethodologyOverview: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdWeighting:1_MethodologyOverview" , "shape": "http://ddi-alliance.org/ns/#MethodologyOverview" },{ "node": "#urn:ddi:int.example:IdDataCollection:1_MethodologyOverview" , "shape": "http://ddi-alliance.org/ns/#MethodologyOverview" },{ "node": "#urn:ddi:int.example:IdSampling:1_MethodologyOverview" , "shape": "http://ddi-alliance.org/ns/#MethodologyOverview" },{ "node": "#urn:ddi:int.example:IdDataProcessing:1_MethodologyOverview" , "shape": "http://ddi-alliance.org/ns/#MethodologyOverview" }]'

InstanceVariable: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IdVarDivisNum:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarUniqueID:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarMode:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarDateComp:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarState:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarDivision:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarA4:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarG1Age:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarXg5:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarWeight:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarPartyAby:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" },{ "node": "#urn:ddi:int.example:IdVarSwingn:1_InstanceVariable" , "shape": "http://ddi-alliance.org/ns/#InstanceVariable" }]'

VariableCollection: $(OUT).shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT).shex --map '[{ "node": "#urn:ddi:int.example:IdVarGrpAdmim:1_VariableCollection" , "shape": "http://ddi-alliance.org/ns/#VariableCollection" },{ "node": "#urn:ddi:int.example:IdVarGrpCampaign:1_VariableCollection" , "shape": "http://ddi-alliance.org/ns/#VariableCollection" },{ "node": "#urn:ddi:int.example:IdVarGrpEduc:1_VariableCollection" , "shape": "http://ddi-alliance.org/ns/#VariableCollection" },{ "node": "#urn:ddi:int.example:IdVarGrpWeight:1_VariableCollection" , "shape": "http://ddi-alliance.org/ns/#VariableCollection" },{ "node": "#urn:ddi:int.example:IdVarGrpResults:1_VariableCollection" , "shape": "http://ddi-alliance.org/ns/#VariableCollection" }]'

ValueMapping: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IDVmVarDivisNum:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarUniqueID:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarMode:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarDateComp:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarState:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarDivision:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarA4:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarG1Age:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarXg5:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarWeight:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarPartyAby:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" },{ "node": "#urn:ddi:int.example:IDVmVarSwingn:1_ValueMapping" , "shape": "http://ddi-alliance.org/ns/#ValueMapping" }]'

DataPoint: $(OUT)-nested.shex
	$(VALIDATE) -d AustralianElectionStudySubset.ttl -x $(OUT)-nested.shex --map '[{ "node": "#urn:ddi:int.example:IDDptVarDivisNum:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptVarUniqueID:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptMode:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptDateComp:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptState:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptDivision:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptA4:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptG1Age:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptXg5:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptWeight:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptPartyAby:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" },{ "node": "#urn:ddi:int.example:IDDptSwingn:1_DataPoint" , "shape": "http://ddi-alliance.org/ns/#DataPoint" }]'

testOZ: DI Study Access Coverage SpatialCoverage UnitType GeographicUnit TemporalCoverage TopicalCoverage Individual Organization FundingInformation MethodologyOverview InstanceVariable VariableCollection ValueMapping DataPoint

.DELETE_ON_ERROR:

