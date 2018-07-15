const fs = require('fs')
const jsonCycles = require('circular-json')
// const jsonCycles = require('flatted')

  const XSD = 'http://www.w3.org/2001/XMLSchema#'
  const UMLD = 'http://schema.omg.org/spec/UML/2.1/uml.xml#'
  const UMLP = 'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#'
  const assert = require('chai').assert
  const expect = require('chai').expect
  const normalizeType = function (type) {
    if (!type) {
      return type // pass undefined on
    }
    if (type === 'xs:language') {
      return XSD + 'language'
    }
    let dtList = [
      { from: UMLD + 'String', to: XSD + 'string' },
      { from: UMLD + 'Integer', to: XSD + 'integer' },
      { from: UMLD + 'Boolean', to: XSD + 'boolean' },
      { from: UMLP + 'String', to: XSD + 'string' },
      { from: UMLP + 'Integer', to: XSD + 'integer' },
      { from: UMLP + 'Boolean', to: XSD + 'boolean' },
      { from: UMLP + 'Real', to: XSD + 'double' },
      { from: UMLP + 'UnlimitedNatural', to: XSD + 'double' }
    ]
    let dtMap = dtList.reduce(
      (acc, elt) => objSet(acc, elt.from, elt.to),
      {}
    )
    if (type in dtMap) {
      return dtMap[type]
    }
    if (type.startsWith(UMLP)) {
      return UMLD + type.substr(UMLP.length)
    }
    return type
  }
  const ParserOpts = {
    viewPattern: /Functional999Views/,
    // normalizeType: normalizeType,
    nameMap: {
      'Views (Exported from Drupal)': 'Views',
      'Class Model (Exported from Drupal)': 'ddi4_model',
      'ClassLibrary': 'ddi4_model', // minimize diffs
      'FunctionalViews': 'Views',
      'xsd:anyUri': XSD + 'anyURI',
      'xsd:anguage': XSD + 'language'
    }
  }

const UmlModel = require('../doc/uml-model')({
  externalDatatype: n => n && n.startsWith(UMLP)
})

describe ('A UML Model', function() {
  it ('should parse a manual structure', function(done) {
    let mod1 = { rtti: 'Model', id: 'mod1', source: { a:1, b:2 }, elements: [
    ]}
    let pak1 = { rtti: 'Package', id: 'pak1', elements: [], references: [mod1] }
    mod1.elements.push(pak1)
    let cls1 = { rtti: 'Class', id: 'cls1', properties: [], references: [pak1] }
    pak1.elements.push(cls1)
    let prp1 = { rtti: 'Property', id: 'prp1', type: cls1 }
    cls1.properties.push(prp1)
    cls1.references.push(prp1)

    let j = {
      "rtti":"Model",
      "id":"mod1",
      "source":{"a":1,"b":2},
      "elements":[
        { "rtti":"Package",
          "id":"pak1",
          "elements":[
            { "rtti":"Class",
              "id":"cls1",
              "properties":[
                { "rtti":"Property","id":"prp1","type":{"_idref":"cls1"} }
              ],"references":[
                {"_idref":"pak1"},
                {"_idref":"prp1"}
              ]}
          ],
          "references":[
            {"_idref":"mod1"}
          ]}
      ]}
    let um1 = UmlModel.fromJSON(JSON.stringify(j))
    assert(typeof um1.diffs === 'function')
    let pk1 = um1.elements[0]
    assert(typeof pk1.diffs === 'function')
    assert(pk1.references[0] === um1)
    let cl1 = pk1.elements[0]
    assert(typeof cl1.diffs === 'function')
    assert(cl1.references[0] === pk1)
    let pr1 = cl1.properties[0]
    assert(typeof pr1.diffs === 'function')
    assert(cl1.references[1] === pr1)
    assert(pr1.type === cl1)
    done()
  })

  it ('should parse and compare all.xmi', function(done) {
    const UmlParser = require('../doc/canonical-uml-xmi-parser')(ParserOpts)
    let source = {
      method: 'fs.readFileSync',
      resource: '../doc/canonical-uml-xmi-parser',
      timestamp: new Date().toISOString()
    }
    let filePath = '../doc/DDI4_PIM_canonical.xmi'
    // let filePath = './XMI/all.xmi'
    UmlParser.parseXMI(fs.readFileSync(__dirname + '/' + filePath, 'UTF-8'), source, parserCallback)

    function parserCallback (err, xmiGraph) {
      if (err) {
        throw (err)
      }
      let model = UmlParser.toUML(xmiGraph)
      let x = [
        "getClasses",
        "getDatatypes",
        "getEnumerations",
        "getProperties",
      ]
      x.forEach(
        k => delete model[k]
      )

      // let options = { fixed: 0 }
      // let str = UmlModel.toJSON(model, options)
      // fs.writeFileSync(__dirname + '/' + 't.json', str, { encoding: 'utf-8' })
      // console.log(str)
      // let obj = UmlModel.fromJSON(str/*fs.readFileSync(__dirname + '/' + 'all.json', 'utf-8')*/)
      let obj = UmlModel.fromJSON(fs.readFileSync(__dirname + '/' + 'DDI4_PIM_canonical.json', 'utf-8'))
      // expect(obj).to.deep.equal(model);
      // expect(obj).toEqual(model);
      debugger
      let diffs = model.diffs(obj, s => {throw Error(s)})
      if (diffs.length) {
        throw Error('unexpected diffs: ' + diffs.join('\n'))
      }

      done()
    }
  });
});

  function objSet (obj, key, value) {
    let add = { }
    add[key] = value
    return Object.assign({}, obj, add)
  }
