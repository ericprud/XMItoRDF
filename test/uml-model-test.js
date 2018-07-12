const fs = require('fs')
const jsonCycles = require('circular-json')
// const jsonCycles = require('flatted')

  const XSD = 'http://www.w3.org/2001/XMLSchema#'
  const UMLD = 'http://schema.omg.org/spec/UML/2.1/uml.xml#'
  const UMLP = 'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#'
  // const expect = require('chai').expect
  const normalizeType = function (type) {
    return type
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
    normalizeType: normalizeType,
    nameMap: {
      'Views (Exported from Drupal)': 'Views',
      'Class Model (Exported from Drupal)': 'ddi4_model',
      'ClassLibrary': 'ddi4_model', // minimize diffs
      'FunctionalViews': 'Views',
      'xsd:anyUri': XSD + 'anyURI',
      'xsd:anguage': XSD + 'language'
    }
  }

describe('A UML Model', function() {
  it('should parse and compare', function(done) {
    const UmlModel = require('../doc/uml-model')({
      externalDatatype: n => n.startsWith(XSD)
    })
    const UmlParser = require('../doc/canonical-uml-xmi-parser')(ParserOpts)
    let source = {
      method: 'fs.readFileSync',
      resource: '../doc/canonical-uml-xmi-parser',
      timestamp: new Date().toISOString()
    }
    // let filePath = '../doc/DDI4_PIM_canonical.xmi'
    let filePath = './XMI/all.xmi'
    UmlParser.parseXMI(fs.readFileSync(__dirname + '/' + filePath, 'UTF-8'), source, parserCallback)

    function parserCallback (err, xmiGraph) {
      if (err) {
        throw (err)
      } else {
        if (false) {
          let p1 = new UmlModel.Point(1, 2)
          let p2 = new UmlModel.Point(3, 4)
          p1.self = p1
          p2.self = p2
          p1.other = p2
          p2.other = p1
          let p3 = new UmlModel.Point(p1, p2)
          let p1t = jsonCycles.stringify(p3)
          console.log(p1t)
          let s1 = '{"x":{"x":1,"y":2,"self":"~x","other":{"x":3,"y":4,"self":"~x~other","other":"~x"}},"y":"~x~other"}'
          let s2 = `
          { "x": { "x": 1, "y": 2, "self": "~x", "other": "~y" },
            "y": { "x": 3, "y": 4, "self": "~y", "other": "~x" }
          }`
          // expect(p1t).toEqual(s1)
          expect(p1t).to.deep.equal(s1)
          let p1c = jsonCycles.parse(p1t)
          // expect(p1c).toEqual(p3)
          expect(p1c).to.deep.equal(p3)
          let p2c = jsonCycles.parse(s2)
          // expect(p2c).toEqual(p3)
          expect(p2c).to.deep.equal(p3)
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
        let str = jsonCycles.stringify(model)
        // fs.writeFileSync(__dirname + '/' + 'all.jscycle', str, { encoding: 'utf-8' })
        // console.warn(str)
        // let obj = jsonCycles.parse(str)
        let obj = jsonCycles.parse(fs.readFileSync(__dirname + '/' + 'all.jscycle', 'utf-8'))
        // expect(obj).to.deep.equal(model);
        // expect(obj).toEqual(model);
        let diffs = model.diffs(obj, s => {throw Error(s)})
        if (diffs.length) {
          throw Error('unexpected diffs: ' + diffs.join('\n'))
        }

        done()
      }
    }
  });
});

  function objSet (obj, key, value) {
    let add = { }
    add[key] = value
    return Object.assign({}, obj, add)
  }
