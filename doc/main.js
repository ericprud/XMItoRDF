function main () {
  const TOGGLE_TIME = 50 // time in μsec to toggle collapsed lists.
  const RENDER_DELAY = 10 // time to pause for display (horrible heuristics). .css('opacity', .99)
  const BUILD_PRODUCTS = true // can disable if OWL and ShEx construction crashes.

  function docURL (term) {
    return 'http://lion.ddialliance.org/ddiobjects/' +
      term.toLowerCase() + '#parent_properties'
  }

  function getName (elt) {
    return 'name' in elt.$ ? elt.$.name : null
  }

  function getValue (elt) {
    return 'value' in elt.$ ? elt.$.value : null
  }

  function getGeneral (elt) {
    return 'general' in elt.$ ? elt.$.general : null
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
      let index = {}
      // let realized = makeHierarchy()
      let root = getRootElement(xmiText)
      let parsedData = {}
      // parsedData.root = root
      parsedData.myClasses = classes
      parsedData.myProperties = properties
      parsedData.enums = enums
      parsedData.datatypes = datatypes
      parsedData.hierarchy = classHierarchy.roots
      status.text('indexing...')

      let delay = {
        index: function () {
          // parsedData.index = {}
          indexXML(root, [])

          Object.keys(properties).forEach(propName => {
            let p = properties[propName]
            let s = p.sources.reduce((acc, s) => {
              let t = s.type || s.typeRef
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
            classHierarchy: classHierarchy,
            index: index})

          status.text('rendering structure...')
          window.setTimeout(delay.render, RENDER_DELAY)

          function indexXML (elt, parents) {
            let parent = parents[parents.length - 1]
            let type = elt.$['xmi:type']
            let recurse = true
            if ('xmi:id' in elt.$) {
              let id = elt.$['xmi:id']
              let name = getName(elt)
              index[id] = { element: elt, parents: parents }
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
                  if (name in classes) {
                    throw Error('already seen class name ' + name)
                  }
                  classes[name] = {
                    properties: [],
                    realizes: [],
                    others: [],
                    parents: parents,
                    superClasses: []
                  }
                  // record class hierarchy
                  if ('generalization' in elt) {
                    classHierarchy.add(getGeneral(elt.generalization[0]), name)
                    classes[name].superClasses.push(elt.generalization[0])
                  }
                  break
                case 'uml:Property':
                  if (name === parent) {
                    if (triple[2] === 'realizes') {
                      classes[parent].realizes.push(elt.type[0].$['xmi:idref'])
                    } else {
                      classes[parent].others.push(triple[2])
                    }
                  } else if (!name) {
                    // throw Error('expected name in ' + JSON.stringify(elt.$) + ' in ' + parent)
                  } else if (name.charAt(0).match(/[A-Z]/)) {
                    throw Error('unexpected property name ' + name + ' in ' + parent)
                  } else {
                    let propertyRecord = {
                      in: parent,
                      id: id,
                      name: name,
                      typeRef: elt.type[0].$['xmi:idref'],
                      type: elt.type[0].$['href'],
                      lower: getValue(elt.lowerValue[0]) || 0,
                      upper: getValue(elt.upperValue[0]) || 99
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
                    if (triple[1] !== parent) {
                      console.warn('parent mismatch: ', triple, parent)
                    }
                  }
                  break
                case 'uml:Association':
                  recurse = false
                  break
                case 'uml:Enumeration':
                  if (name in enums) {
                    throw Error('already seen class name ' + name)
                  }
                  enums[name] = {
                    elements: [],
                    values: elt.ownedLiteral.map(
                      l => getName(l)
                    ),
                    parents: parents
                  }
                  // record class hierarchy
                  if ('generalization' in elt) {
                    throw Error("need to handle inherited enumeration " + getGeneral(elt.generalization[0]) + " " + name)
                  }
                  break
                case 'uml:DataType':
                  if (name in datatypes) {
                    throw Error('already seen class name ' + name)
                  }
                  datatypes[name] = {
                    elements: [],
                    parents: parents
                  }
                  // record class hierarchy
                  if ('generalization' in elt) {
                    throw Error("need to handle inherited datatype " + getGeneral(elt.generalization[0]) + " " + name)
                  }
                  break
                case 'uml:Model':
                case 'uml:Package':
                  // Pass through to get to nested goodies.
                  break
                default:
                  console.log('need handler for ' + type)
              }

              if (recurse) {
                // walk desendents
                let skipTheseElements = ['lowerValue', 'upperValue', 'generalization', 'type', 'name', 'isAbstract', 'URI', 'ownedLiteral']
                Object.keys(elt).filter(k => k !== '$' && skipTheseElements.indexOf(k) === -1).forEach(k => {
                  elt[k].forEach(sub => {
                    indexXML(sub, parents.concat(name))
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
              title += elt.id
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
              : $(elt.length > 50 ? '<pre/>' : '<span/>').addClass('scalar').text(elt)
          }
          into.append($('<li/>').text(title).append(value))
        }))
      }

      function reusedProperties (classes, into) {
        const x = Object.keys(classes).reduce((acc, klass) => {
          classes[klass].properties.forEach(
            field => {
              let a = field.id.split(/_/)
              field = a[a.length - 1]
              if (!(field in acc.seen)) {
                acc.seen[field] = [klass]
              } else {
                acc.seen[field].push(klass)
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

        // Build package hierarchy for classes and enums.
        let p = [classes, enums, datatypes]
        p.forEach(obj => Object.keys(obj).forEach(
          className => { // packageHierarch reflects containership of packages.
            for (let i = 0; i < obj[className].parents.length - 1; ++i) {
              packageHierarchy.add(obj[className].parents[i], obj[className].parents[i + 1])
            }
          }))

        if (BUILD_PRODUCTS) {
          // Render package hierarchy.
          owlx = owlx.concat(walkHierarchy(
            firstBranch(packageHierarchy.roots), 'By',
            (c, p) => `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${c}_Package"/>
        <Class abbreviatedIRI="ddi:${p}_Package"/>
    </SubClassOf>`
          ))

          // Declare properties
          owlx = owlx.concat(Object.keys(properties).filter(propName => !(propName in xHash)).map(
            propName => {
              let p = properties[propName].uniformType[0]
              let t = isObject(p) ? 'Object' : 'Data'
              return `    <Declaration>
        <${t}Property abbreviatedIRI="ddi:${propName}"/>
    </Declaration>
    <${t}PropertyRange>
        <${t}Property abbreviatedIRI="ddi:${propName}"/>
        <${isObject(p) ? "Class" : "Datatype"} abbreviatedIRI="${pname(p)}"/>
    </${t}PropertyRange>`
            }
          ))
          owlm = owlm.concat(Object.keys(properties).filter(propName => !(propName in xHash)).map(
            propName => {
              let p = properties[propName].uniformType[0]
              let t = isObject(p) ? 'Object' : 'Data'
              return t + 'Property: ddi:' + propName + ' Range: ' + pname(p)
            }
          ))

          // Create Classes/Shapes
          owlx = owlx.concat(Object.keys(classes).map(
            className => `    <Declaration>
        <Class abbreviatedIRI="ddi:${className}"/>
    </Declaration>\n` +
              classes[className].properties.filter(
                propertyRecord => !(propertyRecord.name in xHash)
              ).map(
                propertyRecord => {
                  let propName = propertyRecord.name
                  let p = properties[propName].uniformType[0]
                  let t = isObject(p) ? 'Object' : 'Data'
                  let type = propName in xHash ? 'owl:Thing' : pname(p)
                  return `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${className}"/>
        <${t}AllValuesFrom>
            <${t}Property abbreviatedIRI="ddi:${propName}"/>
            <${isObject(p) ? "Class" : "Datatype"} abbreviatedIRI="${type}"/>
        </${t}AllValuesFrom>
    </SubClassOf>`
                }
              ).concat(
                (classes[className].superClasses).map(
                  superClass =>
                    `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${className}"/>
        <Class abbreviatedIRI="ddi:${getGeneral(superClass)}"/>
    </SubClassOf>`
                )
              ).concat([
                `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${className}"/>
        <Class abbreviatedIRI="ddi:${classes[className].parents[classes[className].parents.length - 1]}_Package"/>
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
            name => [].concat(
              `    <EquivalentClasses>
    <Class abbreviatedIRI="ddi:${name}"/>
        <ObjectOneOf>`,
              enums[name].values.map(
                v => `            <NamedIndividual abbreviatedIRI="ddi:${v}"/>`
              ),
              `       </ObjectOneOf>
    </EquivalentClasses>
    <SubClassOf>
        <Class abbreviatedIRI="ddi:${name}"/>
        <Class abbreviatedIRI="ddi:${enums[name].parents[enums[name].parents.length - 1]}_Package"/>
    </SubClassOf>`).join('\n')))

          // Add datatypes.
          owlx = owlx.concat(Object.keys(datatypes).map(
            name => [].concat(
              `    <DatatypeDefinition>
        <Datatype abbreviatedIRI="ddi:${name}"/>
        <Datatype abbreviatedIRI="xsd:string"/>
    </DatatypeDefinition>
    <SubClassOf>
        <Class abbreviatedIRI="ddi:${name}"/>
        <Class abbreviatedIRI="ddi:${datatypes[name].parents[datatypes[name].parents.length - 1]}_Package"/>
    </SubClassOf>`).join('\n')))

          // Terminate the various forms:
          owlx = owlx.concat([
            '</Ontology>\n'
          ])
        }
        function isObject (term) {
          return pname(term).startsWith('ddi:')
        }
      }

      function shexCardinality (propertyRecord) {
        let lower = parseInt(propertyRecord.lower || 0 )
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

      function pname (id) {
        const m = [
          {url: 'http://www.w3.org/2001/XMLSchema#', prefix: 'xsd:'},
          {url: 'http://schema.omg.org/spec/UML/2.1/uml.xml#', prefix: 'umld:'},
          {url: 'http://www.w3.org/XML/1998/namespace#', prefix: 'xhtml'}
        ]
        let ret = m.map(pair =>
          id.startsWith(pair.url)
            ? pair.prefix + id.substr(pair.url.length)
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

  function firstBranch (root) {
    while (Object.keys(root).length === 1) {
      root = root[Object.keys(root)[0]]
    }
    return root
  }

}

window.onload = main
