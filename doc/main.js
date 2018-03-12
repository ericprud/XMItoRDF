function main () {
  const TOGGLE_TIME = 50 // time in μsec to toggle collapsed lists.
  const RENDER_DELAY = 10 // time to pause for display (horrible heuristics). .css('opacity', .99)
  const BUILD_PRODUCTS = true // can disable if OWL and ShEx construction crashes.

  function docURL (term) {
    return 'http://lion.ddialliance.org/ddiobjects/' +
      term.toLowerCase() + '#parent_properties'
  }

  function parseName (elt) {
    let ret = 'name' in elt.$ ? elt.$.name : null
    let nameMap = {
      'Views (Exported from Drupal)': 'Views',
      'Class Model (Exported from Drupal)': 'ddi4_model',
      'ClassLibrary': 'ddi4_model', // minimize diffs
      'FunctionalViews': 'Views',
      'xsd:anyUri': 'xsd:anyURI',
      'xsd:anguage': 'xsd:language'
    }
    return ret in nameMap ? nameMap[ret] : ret
  }

  function parseValue (elt, deflt) { // 'default' is a reserved word
    return 'value' in elt.$ ? elt.$.value : deflt
  }

  function parseGeneral (elt) {
    return 'general' in elt.$ ? elt.$.general : null
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
            render(loadEvent.target.result, file.name, status)
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
        render(text, source, status)
      }, RENDER_DELAY)
    }).catch(function (error) {
      div.append($('<pre/>').text(error)).addClass('error')
    })
    return true
  })

  function render (xmiText, title, status) {
    let div = $('<div/>', {'id': title, 'class': 'result'}).appendTo('#render')
    let reparse = $('<button/>').text('reparse').on('click', parse)
    $('<h2/>').text(title).append(reparse).appendTo(div)

    function parse () {
      let structure = $('<ul/>')
      let triples = {}
      makeHierarchy.test()
      let classHierarchy = makeHierarchy()
      let packageHierarchy = makeHierarchy()
      let classes = {}
      let properties = {}
      let enums = {}
      let datatypes = {}
      let packages = {}
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
      // let realized = makeHierarchy()
      let root = getRootElement(xmiText)
      let parsedData = {}
      // parsedData.root = root
      parsedData.classes = classes
      parsedData.properties = properties
      parsedData.enums = enums
      parsedData.datatypes = datatypes
      parsedData.classHierarchy = classHierarchy.roots
      status.text('indexing...')

      let delay = {
        index: function () {
          // parsedData.index = {}
          indexXML(root, [])

          // Change relations to datatypes to be attributes.
          // Change relations to the classes and enums to reference the name.
          Object.keys(properties).forEach(
            p => properties[p].sources.forEach(
              s => {
                if (s.relation in datatypes) {
                  console.log('changing property ' + p + ' to have attribute type ' + expandPrefix(datatypes[s.relation].name))
                  s.attribute = expandPrefix(datatypes[s.relation].name)
                  s.relation = undefined
                } else if (s.relation in classes) {
                  s.relation = classes[s.relation].name
                } else if (s.relation in enums) {
                  s.relation = enums[s.relation].name
                }
              }))

          Object.keys(properties).forEach(propName => {
            let p = properties[propName]
            let s = p.sources.reduce((acc, s) => {
              let t = s.attribute || s.relation
              if (acc.length > 0 && acc.indexOf(t) === -1) {
                // debugger;
                // a.find(i => b.indexOf(i) !== -1)
              }
              return acc.indexOf(t) === -1 ? acc.concat(t) : acc
            }, [])
            p.uniformType = s
          }, [])

          console.dir({
            classes: classes,
            properties: properties,
            enums: enums,
            datatypes: datatypes,
            triples: triples,
            classHierarchy: classHierarchy})

          status.text('rendering structure...')
          window.setTimeout(delay.render, RENDER_DELAY)

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
                        superClassId = parseGeneral(superClassElt)
                        classHierarchy.add(superClassId, name)
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
                      upper: parseValue(elt.upperValue[0], '*')
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
                  packages[id] = {
                    name: name,
                    id: id,
                    parents: parents
                  }
                  if (parents.length) {
                    packageHierarchy.add(packages[parent].name, name)
                  }
                  break
                  // Pass through to get to nested goodies.
                case 'uml:ElementImport':
                  break
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
        },

        render: function () {
          structureToListItems(parsedData, structure)
          collapse(structure)

          status.text('diagnostics...')
          window.setTimeout(delay.diagnostics, RENDER_DELAY)
        },

        diagnostics: function () {
          let diagnostics = $('<ul/>')
          reusedProperties(classes, diagnostics)
          polymorphicProperties(properties, diagnostics)
          console.dir({owlx: owlx, owlm: owlm, shexc: shexc})
          // puns(parsedData, diagnostics)
          addTriples(triples, diagnostics)
          collapse(diagnostics)

          div.append($('<ul/>').append(
            $('<li/>').text('structure').append(structure),
            $('<li/>').text('diagnostics').append(diagnostics),
            $('<li/>').append(
              'OWL: ',
              $('<a/>', {href: ''}).text('XML').on('click', () => download(owlx.join('\n\n'), 'application/xml', 'ddi.xml')),
              ' | ',
              $('<a/>', {href: ''}).text('Manchester').on('click', () => download(owlm.join('\n\n'), 'text/plain', 'ddi.omn'))
            ),
            $('<li/>').append(
              'ShEx: ',
              $('<a/>', {href: ''}).text('Compact').on('click', () => download(shexc.join('\n\n'), 'text/shex', 'ddi.shex'))
            )
          ))

          status.text('')
        }
      }
      window.setTimeout(delay.index, RENDER_DELAY)

      function structureToListItems (object, into) {
        into.append(Object.keys(object).map(k => {
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
        let xHash = x.reduce(
          (acc, propName, idx) =>
            addKey(acc, propName, idx)
          , {})
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

        if (BUILD_PRODUCTS) {
          // Render package hierarchy.
          owlx = owlx.concat(walkHierarchy(
            firstBranch(packageHierarchy.roots), 'DDI_outer',
            (c, p) => `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${c}_Package"/>
        <Class abbreviatedIRI="ddi:${p}_Package"/>
    </SubClassOf>`
          ))

          // Declare properties
          owlx = owlx.concat(Object.keys(properties).filter(propName => !(propName in xHash)).map(
            propName => {
              let p = properties[propName]
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
          owlm = owlm.concat(Object.keys(properties).filter(propName => !(propName in xHash)).map(
            propName => {
              let p = properties[propName]
              let t = isObject(p) ? 'Object' : 'Data'
              return t + 'Property: ddi:' + propName + ' Range: ' + pname(p.uniformType[0])
            }
          ))

          // Create Classes/Shapes
          owlx = owlx.concat(Object.keys(classes).map(
            classId => `    <Declaration>
        <Class abbreviatedIRI="ddi:${classes[classId].name}"/>
    </Declaration>\n` +
              classes[classId].properties.filter(
                propertyRecord => !(propertyRecord.name in xHash)
              ).map(
                propertyRecord => {
                  let propName = propertyRecord.name
                  let p = properties[propName]
                  let t = isObject(p) ? 'Object' : 'Data'
                  let type = propName in xHash ? 'owl:Thing' : pname(p.uniformType[0])
                  return `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${classes[classId].name}"/>
        <${t}AllValuesFrom>
            <${t}Property abbreviatedIRI="ddi:${propName}"/>
            <${isObject(p) ? "Class" : "Datatype"} abbreviatedIRI="${type}"/>
        </${t}AllValuesFrom>
    </SubClassOf>`
                }
              ).concat(
                (classes[classId].superClasses).map(
                  superClass =>
                    `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${classes[classId].name}"/>
        <Class abbreviatedIRI="ddi:${classes[superClass].name}"/>
    </SubClassOf>`
                )
              ).concat([
                `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${classes[classId].name}"/>
        <Class abbreviatedIRI="ddi:${packages[classes[classId].parents[classes[classId].parents.length - 1]].name}_Package"/>
    </SubClassOf>`
              ]).join('\n')
          ))
          owlm = owlm.concat(Object.keys(classes).map(
            className => 'Class: ddi:' + className + ' SubClassOf:\n' +
              classes[className].properties.map(
                propertyRecord => {
                  let propName = propertyRecord.name
                  let type = propName in xHash ? 'owl:Thing' : pname(properties[propName].uniformType[0])
                  return '  ddi:' + propName + ' only ' + type
                }
              ).join(',\n')
          ))
          shexc = shexc.concat(Object.keys(classes).map(
            className => 'ddi:' + className + ' {\n' +
              classes[className].properties.map(
                propertyRecord => {
                  let propName = propertyRecord.name
                  let type = propName in xHash ? '.' : pname(properties[propName].uniformType[0])
                  let refChar = properties[propName].sources[0].type === undefined ? '@' : ''
                  let card = shexCardinality(propertyRecord)
                  return '  ddi:' + propName + ' ' + refChar + type + ' ' + card
                }
              ).join(';\n') + '\n} // rdfs:definedBy <' + docURL(className) + '>'
          ))

          // Enumerate enumerations (enumeratively).
          owlx = owlx.concat(Object.keys(enums).map(
            id => [].concat(
              `    <EquivalentClasses>
    <Class abbreviatedIRI="ddi:${enums[id].name}"/>
        <ObjectOneOf>`,
              enums[id].values.map(
                v => `            <NamedIndividual abbreviatedIRI="ddi:${v}"/>`
              ),
              `       </ObjectOneOf>
    </EquivalentClasses>
    <SubClassOf>
        <Class abbreviatedIRI="ddi:${enums[id].name}"/>
        <Class abbreviatedIRI="ddi:${packages[enums[id].parents[enums[id].parents.length - 1]].name}_Package"/>
    </SubClassOf>`).join('\n')))

          // Add datatypes.
          owlx = owlx.concat(Object.keys(datatypes).map(
            id => [].concat(
              `    <DatatypeDefinition>
        <Datatype abbreviatedIRI="ddi:${datatypes[id].name}"/>
        <Datatype abbreviatedIRI="xsd:string"/>
    </DatatypeDefinition>` /* + `
    <SubClassOf>
        <Class abbreviatedIRI="ddi:${dataypes[id].name}-is-a-datatype"/>
        <Class abbreviatedIRI="ddi:${datatypes[id].parents[datatypes[id].parents.length - 1]}_Package"/>
    </SubClassOf>` */).join('\n')))

          // Terminate the various forms:
          owlx = owlx.concat([
            '</Ontology>\n'
          ])
        }
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
        {url: 'http://schema.omg.org/spec/UML/2.1/uml.xml#', prefix: 'umld'},
        {url: 'http://www.w3.org/XML/1998/namespace#', prefix: 'xhtml'},
        {url: 'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#', prefix: 'umlp'}
      ]

      function pname (id) {
        let ret = KnownPrefixes.map(pair =>
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

      function expandPrefix (pname) {
        let i = pname.indexOf(':')
        if (i === -1) {
          return pname // e.g. LanguageSpecification
        }
        let prefix = pname.substr(0, i)
        let rest = pname.substr(i + 1)
        let ret = KnownPrefixes.map(pair =>
          pair.prefix === prefix
            ? pair.url + rest
            : null
        ).find(v => v)
        if (ret) {
          return ret
        }
        throw Error('no prefix declaration found for ' + pname)
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
    }
    status.text('parsing UML...')
    window.setTimeout(parse, RENDER_DELAY)
  }

  function getRootElement (content) {
    let root
    let parser = new xml2js.Parser()
    parser.parseString(content, function (err, result) {
      if (err) {
        console.error(err)
      } else {
        if (result.hasOwnProperty('uml:Model')) {
          root = result['uml:Model']
        } else if (result.hasOwnProperty('xmi:XMI')) {
          root = result['xmi:XMI']['uml:Model'][0]
        } else {
          throw new window.Exception('The passed document has no immediate root element.')
        }
      }
    })
    return root
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
  function walkHierarchy (n, p, f) {
    return Object.keys(n).reduce((ret, k) => {
      return ret.concat(walkHierarchy(n[k], k, f), f(k, p))
    }, [])
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

  /* Hack to deal with this special idiom:
          <ownedAttribute xmi:type="uml:Property" name="language" xmi:id="LanguageSpecificStructuredStringType_language">
            <type xmi:type="xs:language"/>
          </ownedAttribute>
   */
  function expandPrefix (imALanguage) {
    if (imALanguage === undefined) {
      return undefined
    }
    if (imALanguage === 'xs:language') {
      return 'http://www.w3.org/2001/XMLSchema#language'
    }
    throw Error('unexpected argument to expandPrefix(' + imALanguage + ')')
  }
}

window.onload = main
