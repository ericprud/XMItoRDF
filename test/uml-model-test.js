const fs = require('fs')
const CanonXmiParser = require('../doc/canonical-uml-xmi-parser')

  const XSD = 'http://www.w3.org/2001/XMLSchema#'
  const UMLD = 'http://schema.omg.org/spec/UML/2.1/uml.xml#'
  const UMLP = 'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#'
  const assert = require('chai').assert
  const expect = require('chai').expect
  const normalizeType999 = function (type) {
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

    function objSet (obj, key, value) {
      let add = { }
      add[key] = value
      return Object.assign({}, obj, add)
    }
  }

const ParserOpts = {
  viewPattern: /Functional999Views/,
  // normalizeType: normalizeType,
  nameMap: {
    // 'Views (Exported from Drupal)': 'Views',
    // 'Class Model (Exported from Drupal)': 'ddi4_model',
    'ClassLibrary': 'ddi4_model', // minimize diffs
    'FunctionalViews': 'Views',
    // 'xsd:anyUri': XSD + 'anyURI',
    // 'xsd:anguage': XSD + 'language'
  }
}

const UmlModel = require('../doc/uml-model')({
  externalDatatype: n => n && n.startsWith(UMLP)
})

describe ('A UML Model', function() {
  it ('should construct Model from a manual structure', function(done) {
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

  it ('all XMI should parse and compare', done => testParser('./XMI/all.xmi', 'all.json', done));
  it ('DDI4 XMI should parse and compare', done => testParser('../doc/DDI4_PIM_canonical.xmi', 'DDI4_PIM_canonical.json', done));
  it ('all XMI should parse, toJSON, fromJSON', done => parseToFromJSON('./XMI/all.xmi', 200, done));
  it ('all XMI should round-trip through JSON', done => roundTripJSON('all.json', 200, done));
  it ('removing packages from trim0 XMI', done => removePackages('trim0.json', 'trim0-trimmedPackages.json', done));
  xit ('removing packages from all XMI', done => removePackages('all.json', 'all-trimmedPackages.json', done));
  it ('removing packages from trim0 XMI', done => removeProperties('trim0.json', 'trim0-trimmedProperties.json', done));

function removePackages (json, trimmed, done) {
  let model = UmlModel.fromJSON(fs.readFileSync(__dirname + '/' + json, 'utf-8'))
  model.list('Package').filter(
    pkg => ['PackageTwo', 'PackageThree'].indexOf(pkg.name) !== -1
  ).forEach(
    pkg => pkg.remove(model.missingElements)
  )

  let obj = UmlModel.fromJSON(fs.readFileSync(__dirname + '/' + trimmed, 'utf-8'), {
    missing: (obj, key, target) => {
      console.log('missing', target)
      return new UmlModel.MissingElement(target, [])
    }
  })
  let diffs = model.diffs(obj, s => {throw Error(s)})
  if (diffs.length) {
    throw Error('unexpected diffs: ' + diffs.join('\n'))
  }
  done()
}

function removeProperties (json, trimmed, done) {
  let model = UmlModel.fromJSON(fs.readFileSync(__dirname + '/' + json, 'utf-8'))
  model.list('Class').forEach(
    cls => cls.properties.filter(
      prp => prp.name.endsWith('p1')
    ).forEach(
      prp => prp.remove(model.missingElements)
    )
  )

  let obj = UmlModel.fromJSON(fs.readFileSync(__dirname + '/' + trimmed, 'utf-8'), {
    missing: (obj, key, target) => {
      console.log('missing', target)
      return new UmlModel.MissingElement(target, [])
    }
  })
  let diffs = model.diffs(obj, s => {throw Error(s)})
  if (diffs.length) {
    throw Error('unexpected diffs: ' + diffs.join('\n'))
  }
  done()
}

});

function testParser (xmi, json, done) {
  const UmlParser = CanonXmiParser(ParserOpts)
  let source = {
    method: 'fs.readFileSync',
    resource: xmi,
    timestamp: new Date().toISOString()
  }
  UmlParser.parseXMI(fs.readFileSync(__dirname + '/' + xmi, 'UTF-8'), source, (err, xmiGraph) => {
    if (err) {
      done(err)
    }
    let model = UmlParser.toUML(xmiGraph)
    let obj = UmlModel.fromJSON(fs.readFileSync(__dirname + '/' + json, 'utf-8'))
    // let diffs = model.diffs(obj /*, s => {throw Error(s)} */) // uncomment to throw immediately
    let diffs = model.diffs(obj, s => {throw Error(s)})
    if (diffs.length) {
      throw Error('unexpected diffs: ' + diffs.join('\n'))
    }
    // both mocha and jest are too slow to test equivalence:
    // expect(obj).to.deep.equal(model); // mocha
    // expect(obj).toEqual(model); // jest
    done()
  })
}

function parseToFromJSON (xmi, minFixups, done) {
  const UmlParser = CanonXmiParser(ParserOpts)
  let source = {
    method: 'fs.readFileSync',
    resource: xmi,
    timestamp: new Date().toISOString()
  }
  UmlParser.parseXMI(fs.readFileSync(__dirname + '/' + xmi, 'UTF-8'), source, (err, xmiGraph) => {
    if (err) {
      done(err)
    }
    let model = UmlParser.toUML(xmiGraph)
    let options = { fixed: 0 }
    let str = UmlModel.toJSON(model, options)
    // fs.writeFileSync(__dirname + '/' + 't.json', str, { encoding: 'utf-8' })
    assert(options.fixed > minFixups)

    let obj = UmlModel.fromJSON(str)
    // let diffs = model.diffs(obj /*, s => {throw Error(s)} */) // uncomment to throw immediately
    let diffs = model.diffs(obj, s => {throw Error(s)})
    if (diffs.length) {
      throw Error('unexpected diffs: ' + diffs.join('\n'))
    }
    done()
  })
}

function roundTripJSON (json, minFixups, done) {
  let model = UmlModel.fromJSON(fs.readFileSync(__dirname + '/' + json, 'utf-8'))
  let options = { fixed: 0 }
  let str = UmlModel.toJSON(model, options)
  assert(options.fixed > minFixups)

  let obj = UmlModel.fromJSON(str)
  // let diffs = model.diffs(obj /*, s => {throw Error(s)} */) // uncomment to throw immediately
  let diffs = model.diffs(obj, s => {throw Error(s)})
  if (diffs.length) {
    throw Error('unexpected diffs: ' + diffs.join('\n'))
  }
  done()
}

