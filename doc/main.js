function main () {
  const TOGGLE_TIME = 50 // time in μsec to toggle collapsed lists.
  const RENDER_DELAY = 10 // time to pause for display (horrible heuristics). .css('opacity', .99)
  const BUILD_PRODUCTS = true // can disable if OWL and ShEx construction crashes.
  const UPPER_UNLIMITED = '*'

  function docURL (term) {
    return 'http://lion.ddialliance.org/ddiobjects/' +
      term.toLowerCase() + '#parent_properties'
  }

  function parseName (elt) {
    let ret = 'name' in elt.$ ? elt.$.name : 'name' in elt ? elt.name[0] : null
    let nameMap = {
      'Views (Exported from Drupal)': 'Views',
      'Class Model (Exported from Drupal)': 'ddi4_model',
      'ClassLibrary': 'ddi4_model', // minimize diffs
      'FunctionalViews': 'Views',
      'xsd:anyUri': 'http://www.w3.org/2001/XMLSchema#anyURI',
      'xsd:anguage': 'http://www.w3.org/2001/XMLSchema#language'
    }
    return !ret ? ret : ret in nameMap ? nameMap[ret] : expandPrefix(ret)
  }

  function parseValue (elt, deflt) { // 'default' is a reserved word
    return 'value' in elt.$ ? elt.$.value : 'value' in elt ? elt.value[0] : deflt
  }

  function parseGeneral (elt) {
    return 'general' in elt.$ ? elt.$.general : 'general' in elt ? elt.general[0].$['xmi:idref'] : null
  }

  function parseEAViews (diagrams) {
    return diagrams.filter(
      diagram => '$' in diagram // eliminate the empty <diagram> element containing datatypes
    ).map(
      diagram => {
        return {
          id: diagram['$']['xmi:id'],
          name: diagram.model[0].$.package,
          members: diagram.elements[0].element.map(
            member => member.$.subject
          )
        }
      }
    )
  }

  function parseCanonicalViews (elt) {
    return elt.packagedElement.map(view => {
      return {
        id: view.$['xmi:id'],
        name: parseName(view),
        members: view.elementImport.map(
          imp => imp.importedElement[0].$['xmi:idref']
        )
      }
    })
  }

  function normalizeType (type) {
    if (!type) {
      return type // pass undefined on
    }
    if (type === 'xs:language') {
      return 'http://www.w3.org/2001/XMLSchema#language'
    }
    let umlp = 'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#'
    let umld = 'http://schema.omg.org/spec/UML/2.1/uml.xml#'
    if (type.startsWith(umlp)) {
      return umld + type.substr(umlp.length)
    }
    return type
  }

  const xml2js = require('xml2js')
  // let rs = Ecore.ResourceSet.create()
  let $ = window.jQuery

  $('#load-file').on('change', function (evt) {
    if (!window.FileReader) {
      return // not supported
    }
    for (let i = 0; i < evt.target.files.length; ++i) {
      (function (file) {
        // Give user some interface feedback before reading.
        let div = $('<div/>', {'id': file.name}).appendTo('#loaded')
        $('<li/>').append($('<a/>', {href: '#' + file.name}).text(file.name)).appendTo('#toc')
        let status = $('<span/>').addClass('status').text('loading')
        $('<h2/>').append(file.name, status).appendTo(div)
        window.setTimeout(() => {
          let loader = new window.FileReader()
          loader.onload = function (loadEvent) {
            if (loadEvent.target.readyState !== 2) {
              console.dir(loadEvent)
              return
            }
            if (loadEvent.target.error) {
              window.alert('Error while reading file ' + file.name + ': ' + loadEvent.target.error)
              return
            }
            // This may take a long time to render.
            $('<textarea/>', {cols: 60, rows: 10}).val(loadEvent.target.result).appendTo(div)
            processXMI(loadEvent.target.result, file.name, status)
          }
          loader.readAsText(file)
        }, RENDER_DELAY)
      })(evt.target.files[i])
    }
  })

  $('#load-url').on('change', function (evt) {
    let source = $(this).val()
    // Give user some interface feedback before reading.
    let div = $('<div/>', {'id': source}).appendTo('#loaded')
    $('<li/>').append($('<a/>', {href: '#' + source}).text(source)).appendTo('#toc')
    let status = $('<span/>').addClass('status').text('loading')
    $('<h2/>').append(source, status).appendTo(div)
    window.fetch(source).then(function (response) {
      if (!response.ok) {
        throw Error('got ' + response.status + ' ' + response.statusText)
      }
      return response.text()
    }).then(function (text) {
      window.setTimeout(() => {
        $('<textarea/>', {cols: 60, rows: 10}).val(text).appendTo(div)
        processXMI(text, source, status)
      }, RENDER_DELAY)
    }).catch(function (error) {
      div.append($('<pre/>').text(error)).addClass('error')
    })
    return true
  })

  function processXMI (xmiText, title, status) {
    let div = $('<div/>', {'id': title, 'class': 'result'}).appendTo('#render')
    let reparse = $('<button/>').text('reparse').on('click', parse)
    $('<h2/>').text(title).append(reparse).appendTo(div)
    let model
    let document
    let triples = {}
    let progress = $('<ul/>')
    div.append(progress)

    xml2js.Parser().parseString(xmiText, function (err, result) {
      if (err) {
        console.error(err)
      } else {
        document = result
        status.text('parsing UML...')
        window.setTimeout(parse, RENDER_DELAY)
      }
    })

    function parse () {
      status.text('indexing...')
      window.setTimeout(index, RENDER_DELAY)
    }

    function index () {
      model = parseModel(document, triples)
      status.text('rendering structure...')
      window.setTimeout(render, RENDER_DELAY)
    }

    function render () {
      let modelUL = $('<ul/>')
      structureToListItems(model, modelUL)
      collapse(modelUL)
      progress.append($('<li/>').text('model').append(modelUL))

      status.text('diagnostics...')
      window.setTimeout(diagnostics, RENDER_DELAY)
    }

    function diagnostics () {
      let diagnostics = $('<ul/>')
      reusedProperties(model.classes, diagnostics)
      polymorphicProperties(model.properties, diagnostics)
      // puns(parsedData, diagnostics)
      addTriples(triples, diagnostics)
      collapse(diagnostics)

      progress.append($('<li/>').text('diagnostics').append(diagnostics))
      status.text('')
      status.text('export all formats...')
      window.setTimeout(exportAllFormats, RENDER_DELAY)
    }

    function exportAllFormats () {
      if (!BUILD_PRODUCTS) {
        return // skip format dump
      }
      let t = dumpFormats(model)
      progress.append(
        $('<li/>').append(
          'OWL: ',
          $('<a/>', {href: ''}).text('XML').on('click', () => download(t.owlx.join('\n\n'), 'application/xml', 'ddi.xml')),
          ' | ',
          $('<a/>', {href: ''}).text('Manchester').on('click', () => download(t.owlm.join('\n\n'), 'text/plain', 'ddi.omn'))
        ),
        $('<li/>').append(
          'ShEx: ',
          $('<a/>', {href: ''}).text('Compact').on('click', () => download(t.shexc.join('\n\n'), 'text/shex', 'ddi.shex'))
        )
      )
      let copy = strip(model, ['AgentRegistryView'])
    }
  }

  function strip (model, viewLabels) {
    if (viewLabels.constructor !== Array) {
      viewLabels = [viewLabels]
    }
    let views = model.views.filter(
      v => viewLabels.indexOf(v.name) !== -1
    )
    let classIds = views.reduce(
      (classIds, view) =>
        classIds.concat(view.members.reduce(
          (x, member) => {
            let parents = model.classHierarchy.parents[member]
            return x.concat(member, parents.filter(
              classId => x.indexOf(classId) === -1
            ))
          }, []))
      , [])
    let classes = classIds.reduce(
      (classes, className) => addKey(classes, className, model.classes[className]), {}
    )
    let properties = Object.keys(model.properties).filter(
      propName => model.properties[propName].sources.find(includedSource)
    ).reduce(
      (acc, propName) => {
        let sources = model.properties[propName].sources.filter(includedSource)
        return addKey(acc, propName, {
          sources: sources,
          uniformType: findMinimalTypes({sources: sources})
        })
      }, [])
    return {}

    function includedSource (source) {
      // properties with a source in classIds
      return classIds.indexOf(source.in) !== -1
    }
  }

  function parseModel (document, triples) {
    // makeHierarchy.test()
    // convenience variables
    let classHierarchy = makeHierarchy()
    let packageHierarchy = makeHierarchy()
    let classes = {}
    let properties = {}
    let enums = {}
    let datatypes = {}
    let packages = {}

    // return structure
    let model = {
      packages: packages,
      classes: classes,
      properties: properties,
      enums: enums,
      datatypes: datatypes,
      classHierarchy: classHierarchy,
      packageHierarchy: packageHierarchy
    }

    // Build the model
    indexXML(document['xmi:XMI']['uml:Model'][0], [])

    // Change relations to datatypes to be attributes.
    // Change relations to the classes and enums to reference the name.
    Object.keys(properties).forEach(
      p => properties[p].sources.forEach(
        s => {
          if (s.relation in datatypes) {
            console.log('changing property ' + p + ' to have attribute type ' + datatypes[s.relation].name)
            s.attribute = datatypes[s.relation].name
            s.relation = undefined
          } else if (s.relation in classes) {
            s.relation = classes[s.relation].name
          } else if (s.relation in enums) {
            s.relation = enums[s.relation].name
          }
        }))

    Object.keys(properties).forEach(propName => {
      let p = properties[propName]
      p.uniformType = findMinimalTypes(p)
    }, [])

    console.dir(model)
    return model

    function indexXML (elt, parents) {
      let parent = parents[parents.length - 1]
      let type = elt.$['xmi:type']
      let recurse = true
      if ('xmi:id' in elt.$) {
        let id = elt.$['xmi:id']
        let name = parseName(elt)
        // Could keep id to elt map around with this:
        // index[id] = { element: elt, parents: parents }
        let triple

        // record triples
        if ((triple = id.match(/([a-zA-Z]+)_([a-zA-Z]+)_([a-zA-Z]+)/))) {
          if (!(triple[2] in triples)) {
            triples[triple[2]] = []
          }
          triples[triple[2]].push(id)
        }

        switch (type) {
          case 'uml:Class':
            if (id in classes) {
              throw Error('already seen class id ' + id)
            }
            classes[id] = {
              id: id,
              name: name,
              properties: [],
              realizes: [],
              others: [],
              parents: parents,
              superClasses: []
            }

            // record class hierarchy (allows multiple inheritance)
            if ('generalization' in elt) {
              elt.generalization.forEach(
                superClassElt => {
                  let superClassId = parseGeneral(superClassElt)
                  classHierarchy.add(superClassId, id)
                  classes[id].superClasses.push(superClassId)
                })
            }
            break
          case 'uml:Property':
            let klass = classes[parent].name
            if (name === klass) {
              if (triple[2] === 'realizes') {
                classes[klass].realizes.push(elt.type[0].$['xmi:idref'])
              } else {
                classes[klass].others.push(triple[2])
              }
            } else if (!name) {
              // throw Error('expected name in ' + JSON.stringify(elt.$) + ' in ' + parent)
            } else if (name.charAt(0).match(/[A-Z]/)) {
              throw Error('unexpected property name ' + name + ' in ' + parent)
            } else {
              let propertyRecord = {
                in: klass,
                id: id,
                name: name,
                relation: elt.type[0].$['xmi:idref'],
                attribute: normalizeType(elt.type[0].$['href'] || elt.type[0].$['xmi:type']),
                lower: parseValue(elt.lowerValue[0], 0),
                upper: parseValue(elt.upperValue[0], UPPER_UNLIMITED)
              }
              if (propertyRecord.upper === '-1') {
                propertyRecord.upper = UPPER_UNLIMITED
              }
              classes[parent].properties.push(propertyRecord)
              if (!(name in properties)) {
                properties[name] = {sources: []}
              }
              properties[name].sources.push(propertyRecord)
            }

            if (triple) {
              if (['source', 'association'].indexOf(triple[3]) === -1) {
                console.warn('unknown relationship: ', triple[3])
              }
              if (triple[1] !== klass) {
                console.warn('parent mismatch: ', triple, klass)
              }
            }
            break
          case 'uml:Association':
            recurse = false
            break
          case 'uml:Enumeration':
            if (id in enums) {
              throw Error('already seen enum id ' + id)
            }
            enums[id] = {
              id: id,
              name: name,
              values: elt.ownedLiteral.map(
                l => parseName(l)
              ),
              parents: parents
            }
            // record class hierarchy
            if ('generalization' in elt) {
              throw Error("need to handle inherited enumeration " + parseGeneral(elt.generalization[0]) + " " + name)
            }
            break
          case 'uml:DataType':
          case 'uml:PrimitiveType':
            if (id in datatypes) {
              throw Error('already seen datatype id ' + id)
            }
            datatypes[id] = {
              name: name,
              id: id,
              parents: parents
            }
            // record class hierarchy
            if ('generalization' in elt) {
              throw Error("need to handle inherited datatype " + parseGeneral(elt.generalization[0]) + " " + name)
            }
            break
          case 'uml:Model':
          case 'uml:Package':
            if (id === 'ddi4_views') {
              model.views = parseEAViews(document['xmi:XMI']['xmi:Extension'][0]['diagrams'][0]['diagram'])
              recurse = false
              break // elide EA views package in package hierarcy
            }
            if (id === 'DDI4-FunctionalViews') {
              model.views = parseCanonicalViews(elt)
              recurse = false
              break // elide canonical views package in package hierarcy
            }
            packages[id] = {
              name: name,
              id: id,
              parents: parents
            }
            if (parents.length) {
              packageHierarchy.add(parent, id)
            }
            break
            // Pass through to get to nested goodies.
          default:
            console.log('need handler for ' + type)
        }

        if (recurse) {
          // walk desendents
          let skipTheseElements = ['lowerValue', 'upperValue', 'generalization', 'type', 'name', 'isAbstract', 'URI', 'ownedLiteral']
          Object.keys(elt).filter(k => k !== '$' && skipTheseElements.indexOf(k) === -1).forEach(k => {
            elt[k].forEach(sub => {
              indexXML(sub, parents.concat(id))
            })
          })
        }
      }
    }
  }

  function reusedProperties (classes, into) {
    const x = Object.keys(classes).reduce((acc, classId) => {
      classes[classId].properties.forEach(
        field => {
          let a = field.id.split(/_/)
          field = a[a.length - 1]
          if (!(field in acc.seen)) {
            acc.seen[field] = [classId]
          } else {
            acc.seen[field].push(classId)
            if (acc.duplicates.indexOf(field) === -1) {
              acc.duplicates.push(field)
            }
          }
        }
      )
      return acc
    }, {seen: {}, duplicates: []})
    into.append($('<li/>').append(
      $('<span/>',
        {title: 'names of properties which are used in more than one class'})
        .text('reused properties'),
      ' (' + x.duplicates.length + ')',
      $('<ul/>').append(
        x.duplicates.sort(
          // sort first by number of duplicates, otherwise by name
          (l, r) => x.seen[r].length - x.seen[l].length || l.localeCompare(r)
        ).map(dupe => {
          return $('<li/>').append(
            $('<span/>').text(dupe).addClass('scalar'),
            ' (' + x.seen[dupe].length + ')',
            $('<ul/>').append(
              x.seen[dupe].map(lookIn => $('<li/>').append(
                $('<a/>', { href: docURL(lookIn) }).text(lookIn)
              ))
            ))
        })
      )))
  }

  function polymorphicProperties (properties, into) {
    let x = Object.keys(properties).filter(
      propName =>
        properties[propName].uniformType.length !== 1 ||
        properties[propName].uniformType[0] === undefined
    )
    into.append($('<li/>').append(
      $('<span/>',
        {title: 'names of properties which have more than one type'})
        .text('polymorphic properties'),
      ' (' + x.length + ')',
      $('<ul/>').append(
        x.sort(
          (l, r) => properties[r].uniformType.length - properties[l].uniformType.length
        ).map(dupe => {
          return $('<li/>').append(
            dupe,
            ' (' + properties[dupe].uniformType.length + ')',
            $('<ul/>').append(
              properties[dupe].uniformType.map(lookIn => $('<li/>').append(
                lookIn
                  ? $('<a/>', { href: docURL(lookIn) }).text(lookIn)
                  : $('<span/>').text('no stated type').addClass('scalar')
              ))
            ))
        })
      )))
  }

  function dumpFormats (model) {
    let x = Object.keys(model.properties).filter(
      propName =>
        model.properties[propName].uniformType.length !== 1 ||
        model.properties[propName].uniformType[0] === undefined
    )
    let xHash = x.reduce(
      (acc, propName, idx) =>
        addKey(acc, propName, idx)
      , {})
    let owlx = [
      '<?xml version="1.0"?>\n' +
        '<Ontology xmlns="http://www.w3.org/2002/07/owl#"\n' +
        '     xml:base="http://ddi-alliance.org/ns/ddi4"\n' +
        '     xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"\n' +
        '     xmlns:xml="http://www.w3.org/XML/1998/namespace"\n' +
        '     xmlns:xsd="http://www.w3.org/2001/XMLSchema#"\n' +
        '     xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"\n' +
        '     ontologyIRI="http://ddi-alliance.org/ns/ddi4">\n' +
        '    <Prefix name="dc" IRI="http://purl.org/dc/elements/1.1/"/>\n' +
        '    <Prefix name="ddi" IRI="http://ddi-alliance.org/ns/#"/>\n' +
        '    <Prefix name="owl" IRI="http://www.w3.org/2002/07/owl#"/>\n' +
        '    <Prefix name="rdf" IRI="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/>\n' +
        '    <Prefix name="xml" IRI="http://www.w3.org/XML/1998/namespace"/>\n' +
        '    <Prefix name="xsd" IRI="http://www.w3.org/2001/XMLSchema#"/>\n' +
        '    <Prefix name="rdfs" IRI="http://www.w3.org/2000/01/rdf-schema#"/>\n' +
        '    <Prefix name="umld" IRI="http://schema.omg.org/spec/UML/2.1/uml.xml#"/>\n' +
        '    <Prefix name="umlp" IRI="http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#"/>\n' +
        '    <Prefix name="xhtml" IRI="http://www.w3.org/1999/xhtml/"/>\n'
    ]
    let owlm = [
      'Prefix: ddi: <http://ddi-alliance.org/ns/#>\n' +
        'Prefix: xsd: <http://www.w3.org/2001/XMLSchema#>\n' +
        'Prefix: umld: <http://schema.omg.org/spec/UML/2.1/uml.xml#>\n' +
        'Prefix: rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n' +
        'Prefix: xhtml: <http://www.w3.org/XML/1998/namespace#>\n' +
        'Ontology: <http://ddi-alliance.org/ddi-owl>\n' +
        '\n'
    ]
    let shexc = [
      'PREFIX ddi: <http://ddi-alliance.org/ns/#>\n' +
        'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n' +
        'PREFIX umld: <http://schema.omg.org/spec/UML/2.1/uml.xml#>\n' +
        'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n' +
        'PREFIX xhtml: <http://www.w3.org/XML/1998/namespace#>\n' +
        '\n'
    ]
    console.dir({owlx: owlx, owlm: owlm, shexc: shexc})

    // Render package hierarchy.
    let packages = firstBranch(model.packageHierarchy.roots)
    owlx = owlx.concat(Object.keys(packages).map(
      p => `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.packages[p].name}_Package"/>
        <Class abbreviatedIRI="ddi:Packages"/>
    </SubClassOf>`
    ))

    // Render view hierarchy.
    if ('views' in model) {
      owlx = owlx.concat(model.views.reduce(
        (acc, view) => acc.concat([`    <SubClassOf>
        <Class abbreviatedIRI="ddi:${view.name}"/>
        <Class abbreviatedIRI="ddi:Views"/>
    </SubClassOf>`], view.members.map(
          member => `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.classes[member].name}"/>
        <Class abbreviatedIRI="ddi:${view.name}"/>
    </SubClassOf>`
        )), []
      ))
    }

    // Declare properties
    owlx = owlx.concat(Object.keys(model.properties).filter(propName => !(propName in xHash)).map(
      propName => {
        let p = model.properties[propName]
        let t = isObject(p) ? 'Object' : 'Data'
        return `    <Declaration>
        <${t}Property abbreviatedIRI="ddi:${propName}"/>
    </Declaration>
    <${t}PropertyRange>
        <${t}Property abbreviatedIRI="ddi:${propName}"/>
        <${isObject(p) ? "Class" : "Datatype"} abbreviatedIRI="${pname(p.sources[0][isObject(p) ? 'relation' : 'attribute'])}"/>
    </${t}PropertyRange>`
      }
    ))
    owlm = owlm.concat(Object.keys(model.properties).filter(propName => !(propName in xHash)).map(
      propName => {
        let p = model.properties[propName]
        let t = isObject(p) ? 'Object' : 'Data'
        return t + 'Property: ddi:' + propName + ' Range: ' + pname(p.uniformType[0])
      }
    ))

    // Create Classes/Shapes
    owlx = owlx.concat(Object.keys(model.classes).map(
      classId => `    <Declaration>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>
    </Declaration>\n` +
        model.classes[classId].properties.filter(
          propertyRecord => !(propertyRecord.name in xHash)
        ).map(
          propertyRecord => {
            let propName = propertyRecord.name
            let p = model.properties[propName]
            let t = isObject(p) ? 'Object' : 'Data'
            let type = propName in xHash ? 'owl:Thing' : pname(p.uniformType[0])
            return `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>
        <${t}AllValuesFrom>
            <${t}Property abbreviatedIRI="ddi:${propName}"/>
            <${isObject(p) ? "Class" : "Datatype"} abbreviatedIRI="${type}"/>
        </${t}AllValuesFrom>
    </SubClassOf>`
          }
        ).concat(
          (model.classes[classId].superClasses).map(
            superClass =>
              `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>
        <Class abbreviatedIRI="ddi:${model.classes[superClass].name}"/>
    </SubClassOf>`
          )
        ).concat(
          model.classes[classId].superClasses.find(
            supercl => // if some superclass appears in the same package...
              model.packages[model.classes[classId].parents[model.classes[classId].parents.length - 1]] ===
              model.packages[model.classes[supercl].parents[model.classes[supercl].parents.length - 1]]
          )
            ? []      // ... skip that package
            : [`    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>
        <Class abbreviatedIRI="ddi:${model.packages[model.classes[classId].parents[model.classes[classId].parents.length - 1]].name}_Package"/>
    </SubClassOf>`
            ]).join('\n')
    ))
    owlm = owlm.concat(Object.keys(model.classes).map(
      className => 'Class: ddi:' + className + ' SubClassOf:\n' +
        model.classes[className].properties.map(
          propertyRecord => {
            let propName = propertyRecord.name
            let type = propName in xHash ? 'owl:Thing' : pname(model.properties[propName].uniformType[0])
            return '  ddi:' + propName + ' only ' + type
          }
        ).join(',\n')
    ))
    shexc = shexc.concat(Object.keys(model.classes).map(
      className => 'ddi:' + className + ' {\n' +
        model.classes[className].properties.map(
          propertyRecord => {
            let propName = propertyRecord.name
            let type = propName in xHash ? '.' : pname(model.properties[propName].uniformType[0])
            let refChar = model.properties[propName].sources[0].type === undefined ? '@' : ''
            let card = shexCardinality(propertyRecord)
            return '  ddi:' + propName + ' ' + refChar + type + ' ' + card
          }
        ).join(';\n') + '\n} // rdfs:definedBy <' + docURL(className) + '>'
    ))

    // Enumerate enumerations (enumeratively).
    owlx = owlx.concat(Object.keys(model.enums).map(
      id => [].concat(
        `    <EquivalentClasses>
    <Class abbreviatedIRI="ddi:${model.enums[id].name}"/>
        <ObjectOneOf>`,
        model.enums[id].values.map(
          v => `            <NamedIndividual abbreviatedIRI="ddi:${v}"/>`
        ),
        `       </ObjectOneOf>
    </EquivalentClasses>
    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.enums[id].name}"/>
        <Class abbreviatedIRI="ddi:${model.packages[model.enums[id].parents[model.enums[id].parents.length - 1]].name}_Package"/>
    </SubClassOf>`).join('\n')))

    // Add datatypes.
    owlx = owlx.concat(Object.keys(model.datatypes).filter(
      id => !pname(model.datatypes[id].name).startsWith('xsd')
    ).map(
      id => [].concat(
        `    <DatatypeDefinition>
        <Datatype abbreviatedIRI="${pname(model.datatypes[id].name)}"/>
        <Datatype abbreviatedIRI="xsd:string"/>
    </DatatypeDefinition>` /* + `
    <SubClassOf>
        <Class abbreviatedIRI="ddi:${dataypes[id].name}-is-a-datatype"/>
        <Class abbreviatedIRI="ddi:${model.datatypes[id].parents[model.datatypes[id].parents.length - 1]}_Package"/>
    </SubClassOf>` */).join('\n')))

    // Terminate the various forms:
    owlx = owlx.concat([
      '</Ontology>\n'
    ])
    return {owlx: owlx, owlm: owlm, shexc: shexc}
  }

  function shexCardinality (propertyRecord) {
    let lower = parseInt(propertyRecord.lower || 0)
    let upper = parseInt(propertyRecord.upper || -1)
    if (lower === 1 && upper === 1) {
      return ''
    } else if (lower === 1 && upper === -1) {
      return '+'
    } else if (lower === 0 && upper === -1) {
      return '*'
    } else if (lower === 0 && upper === 1) {
      return '?'
    } else {
      return '{' + lower + ',' + (upper === -1 ? '' : upper) + '}'
    }
  }

  function isObject (propertyDecl) {
    return !!propertyDecl.sources[0].relation
  }

  const KnownPrefixes = [
    {url: 'http://www.w3.org/2001/XMLSchema#', prefix: 'xsd'},
    {url: 'http://www.w3.org/2001/XMLSchema#', prefix: 'xs'},
    {url: 'http://schema.omg.org/spec/UML/2.1/uml.xml#', prefix: 'umld'},
    {url: 'http://www.w3.org/XML/1998/namespace#', prefix: 'xhtml'},
    {url: 'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#', prefix: 'umlp'}
  ]

  function pname (id) {
    let ret = KnownPrefixes.map(
      pair =>
        id.startsWith(pair.url)
          ? pair.prefix + ':' + id.substr(pair.url.length)
          : null
    ).find(v => v)
    if (ret) {
      return ret
    }
    if (id.startsWith('http:')) {
      console.warn('need namespace for ' + id)
    }
    return 'ddi:' + id
  }

  /* Hack to deal with this special idiom:
     <ownedAttribute xmi:type="uml:Property" name="language" xmi:id="LanguageSpecificStructuredStringType_language">
     <type xmi:type="xs:language"/>
     </ownedAttribute>
  */

  function expandPrefix (pname) {
    let i = pname.indexOf(':')
    if (i === -1) {
      return pname // e.g. LanguageSpecification
    }
    let prefix = pname.substr(0, i)
    let rest = pname.substr(i + 1)
    let ret = KnownPrefixes.map(
      pair =>
        pair.prefix === prefix
          ? pair.url + rest
          : null
    ).find(v => v)
    return ret || pname
  }

  function puns (object, into) {
    const lookIns = ['classes', 'fields', 'associations', 'types', 'enums']
    const x = lookIns.reduce((acc, lookIn) => {
      Object.keys(object[lookIn]).forEach(
        name => {
          if (!(name in acc.seen)) {
            acc.seen[name] = [lookIn]
          } else {
            acc.seen[name].push(lookIn)
            if (acc.duplicates.indexOf(name) === -1) {
              acc.duplicates.push(name)
            }
          }
        }
      )
      return acc
    }, {seen: {}, duplicates: []})
    into.append($('<li/>').append(
      $('<span/>',
        {title: 'names which appear in any two of ' + lookIns})
        .text('puns'),
      ' (' + x.duplicates.length + ')',
      $('<ul/>').append(
        x.duplicates.map(dupe => {
          return $('<li/>').append(
            $('<span/>').text(dupe).addClass('scalar'),
            $('<ul/>').append(
              x.seen[dupe].map(lookIn => $('<li/>').text(lookIn))
            ))
        })
      )))
  }

  function addTriples (triples, into) {
    into.append($('<li/>').append(
      $('<span/>',
        {title: '[a-zA-Z]+_[a-zA-Z]+_[a-zA-Z]+'})
        .text('triples'),
      ' (' + Object.keys(triples).length + ')',
      $('<ul/>').append(
        Object.keys(triples).sort(
          (l, r) => triples[r].length - triples[l].length
        ).map(triple => {
          return $('<li/>').append(
            $('<span/>').text(triple + ' (' + triples[triple].length + ')').addClass('scalar'),
            $('<ul/>').append(
              triples[triple].map(lookIn => $('<li/>').text(lookIn))
            ))
        })
      )))
  }

  /** find the unique object types for a property
   */
  function findMinimalTypes (p) {
    return p.sources.reduce((acc, s) => {
      let t = s.attribute || s.relation
      if (acc.length > 0 && acc.indexOf(t) === -1) {
        // debugger;
        // a.find(i => b.indexOf(i) !== -1)
      }
      return acc.indexOf(t) === -1 ? acc.concat(t) : acc
    }, [])
  }

  function makeHierarchy () {
    let roots = {}
    let parents = {}
    let children = {}
    let holders = {}
    return {
      add: function (parent, child) {
        if (parent in children && children[parent].indexOf(child) !== -1) {
          // already seen
          return
        }
        let target = parent in holders
          ? getNode(parent)
          : (roots[parent] = getNode(parent)) // add new parents to roots.
        let value = getNode(child)

        target[child] = value
        if (child in roots) {
          delete roots[child]
        }

        // // maintain hierarchy (direct and confusing)
        // children[parent] = children[parent].concat(child, children[child])
        // children[child].forEach(c => parents[c] = parents[c].concat(parent, parents[parent]))
        // parents[child] = parents[child].concat(parent, parents[parent])
        // parents[parent].forEach(p => children[p] = children[p].concat(child, children[child]))

        // maintain hierarchy (generic and confusing)
        updateClosure(children, parents, child, parent)
        updateClosure(parents, children, parent, child)
        function updateClosure (container, members, near, far) {
          container[far] = container[far].concat(near, container[near])
          container[near].forEach(
            n => (members[n] = members[n].concat(far, members[far]))
          )
        }

        function getNode (node) {
          if (!(node in holders)) {
            parents[node] = []
            children[node] = []
            holders[node] = {}
          }
          return holders[node]
        }
      },
      roots: roots,
      parents: parents,
      children: children
    }
  }
  makeHierarchy.test = function () {
    let t = makeHierarchy()
    t.add('B', 'C')
    t.add('C', 'D')
    t.add('F', 'G')
    t.add('E', 'F')
    t.add('D', 'E')
    t.add('A', 'B')
    t.add('G', 'H')
    console.dir(t)
  }
  function walkHierarchy (n, f, p) {
    return Object.keys(n).reduce((ret, k) => {
      return ret.concat(
        walkHierarchy(n[k], f, k),
        p ? f(k, p) : []) // outer invocation can have null parent
    }, [])
  }

  function structureToListItems (object, into) {
    into.append(Object.keys(object).filter(
      k => typeof object[k] !== 'function'
    ).map(k => {
      let elt = object[k]
      let title = object.constructor === Array
        ? ''
        : k
      let value
      if (elt === null) {
        title += ':'
        value = $('<span/>').addClass('keyword').text('NULL')
      } else if (typeof elt === 'object') {
        if (elt.constructor === Array) {
          title += ' (' + Object.keys(elt).length + ')'
        } else if ('id' in elt) {
          if (title === '') {
            title = elt.id
          } else if (title !== elt.id) {
            console.log("differ: " + title + ' != ' + elt.id)
            // title += ' ' + 'id=' + elt.id
          }
        } else if ('$' in elt && 'xmi:id' in elt.$) {
          title += elt.$['xmi:id']
        }
        value = $('<ul/>')
        structureToListItems(elt, value)
      } else {
        if (object.constructor !== Array) {
          title += ':'
        }
        value = !elt
          ? ''
          : $(elt.match(/\n/) ? '<pre/>' : '<span/>').addClass('scalar').text(elt)
      }
      into.append($('<li/>').text(title).append(value))
    }))
  }

  // collapsable list from <from> element
  function collapse (from) {
    from.find('li')
      .css('pointer', 'default')
      .css('list-style-image', 'none')
    from.find('li:has(ul)')
      .click(function (event) {
        if (this === event.target) {
          $(this).css(
            'list-style-image',
            (!$(this).children('ul').is(':hidden')) ? 'url(plusbox.gif)' : 'url(minusbox.gif)'
          )
          $(this).children('ul').toggle(TOGGLE_TIME)
          return false
        } else {
          return true
        }
      })
      .css({cursor: 'pointer', 'list-style-image': 'url(plusbox.gif)'})
      .children('ul').hide()
    from.find('li:not(:has(ul))').css({cursor: 'default', 'list-style-image': 'none'})
    return from
  }

  function download (data, mediaType, filename) {
    let blob = new window.Blob([data], {type: mediaType})
    let e = document.createEvent('MouseEvents')
    let a = document.createElement('a')

    a.download = filename
    a.href = window.URL.createObjectURL(blob)
    a.dataset.downloadurl = ['text/json', a.download, a.href].join(':')
    e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    a.dispatchEvent(e)
    return false
  }

  // functional add key/val to object.
  function addKey (obj, prop, val) {
    let toAdd = {}
    toAdd[prop] = val
    return Object.assign({}, obj, toAdd)
  }

  // Find the first nested object which has multiple children.
  function firstBranch (root) {
    while (Object.keys(root).length === 1) {
      root = root[Object.keys(root)[0]]
    }
    return root
  }
}

window.onload = main
