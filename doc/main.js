// Convert DDI XMI to OWL and ShEx

// Global configuration and control variables.
var TOGGLE_TIME = 50 // time in μsec to toggle collapsed lists.
var RENDER_DELAY = 10 // time to pause for display (horrible heuristics). Could try: .css('opacity', .99)
var BUILD_PRODUCTS = true // can disable if OWL and ShEx construction crashes.
var SUPPRESS_DUPLICATE_CLASSES = true // Don't list subclasses in parent's package.
var UPPER_UNLIMITED = '*'

function main () {
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

  function parseAssociation (elt) {
    return 'association' in elt.$ ? elt.$.association : 'association' in elt ? elt.association[0].$['xmi:idref'] : null
  }

  function parseProperties (model, elts, className) {
    let ret = {
      properties: [],
      associations: {},
      others: []
    }
    elts.forEach(elt => {
      let type = elt.$['xmi:type']
      console.assert(type === 'uml:Property')
      let id = elt.$['xmi:id']
      let name = parseName(elt)
      let association = parseAssociation(elt)

      if (association) {
        /* <ownedAttribute xmi:type="uml:Property" name="AgentIndicator" xmi:id="AgentIndicator_member_source" association="AgentIndicator_member_association">
             <type xmi:idref="Agent"/>
             <lowerValue xmi:type="uml:LiteralInteger" xmi:id="AgentIndicator_member_lower"/>
             <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="AgentIndicator_member_upper" value="-1"/>
           </ownedAttribute> */
        ret.associations[id] = {
          in: className,
          id: id,
          name: name,
          type: elt.type[0].$['xmi:idref'],
          lower: parseValue(elt.lowerValue[0], 0),
          upper: parseValue(elt.upperValue[0], UPPER_UNLIMITED)
        }
      } else if (!name) {
        // e.g. canonical *-owned-attribute-n properties.
        // throw Error('expected name in ' + JSON.stringify(elt.$) + ' in ' + parent)
      } else if (name.charAt(0).match(/[A-Z]/)) {
        throw Error('unexpected property name ' + name + ' in ' + className)
      } else {
        ret.properties.push(
          addProperty(
            model, className, id, name, elt.type[0].$['xmi:idref'],
            normalizeType(elt.type[0].$['href'] || elt.type[0].$['xmi:type']),
            parseValue(elt.lowerValue[0], 0),
            parseValue(elt.upperValue[0], UPPER_UNLIMITED))
        )
      }
    })
    return ret
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
    let progress = $('<ul/>')
    div.append(progress)

    status.text('parsing UML...')
    window.setTimeout(parse, RENDER_DELAY)

    function parse () {
      xml2js.Parser().parseString(xmiText, function (err, result) {
        if (err) {
          console.error(err)
        } else {
          document = result
          status.text('indexing...')
          window.setTimeout(index, RENDER_DELAY)
        }
      })
    }

    function index () {
      model = parseModel(document)
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
      let allViews = strip(model, model.views.map(v => v.name))
      console.log(Object.keys(model.classes).filter(k => !(k in allViews.classes)))
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
          $('<a/>', {href: ''}).text('Compact').on('click', () => download(t.shexc.join('\n\n'), 'text/shex', 'ddi.shex')),
          ' | ',
          $('<a/>', {href: ''}).text('HTML').on('click', () => download(t.shexh.join('\n\n'), 'text/shex', 'ddi.shex'))
        )
      )

      console.log('model', model, Object.keys(model.classes).length, Object.keys(model.properties).length)
      model.views.map(v => v.name).forEach(
        viewName => {
          let s = strip(model, viewName)
          console.log(viewName, s, Object.keys(s.classes).length, Object.keys(s.properties).length)
        }
      )
    }
  }

  function strip (model, viewLabels) {
    if (viewLabels.constructor !== Array) {
      viewLabels = [viewLabels]
    }

    let ret = {
      packages: {},
      classes: {},
      properties: {},
      enums: {},
      datatypes: {},
      classHierarchy: makeHierarchy(),
      packageHierarchy: makeHierarchy(),
      views: model.views.filter(
        v => viewLabels.indexOf(v.name) !== -1
      )
    }

    // ret.enums = Object.keys(model.enums).forEach(
    //   enumId => copyEnum(ret, model, enumId)
    // )
    // ret.datatypes = Object.keys(model.datatypes).forEach(
    //   datatypeId => copyDatatype(ret, model, datatypeId)
    // )

    let classIds = ret.views.reduce(
      (classIds, view) =>
        classIds.concat(view.members.reduce(
          (x, member) => {
            let parents = model.classHierarchy.parents[member] || [] // has no parents
            return x.concat(member, parents.filter(
              classId => x.indexOf(classId) === -1
            ))
          }, []))
      , [])
    addDependentClasses(classIds)

    return ret
    // let properties = Object.keys(model.properties).filter(
    //   propName => model.properties[propName].sources.find(includedSource)
    // ).reduce(
    //   (acc, propName) => {
    //     let sources = model.properties[propName].sources.filter(includedSource)
    //     return addKey(acc, propName, {
    //       sources: sources,
    //       uniformType: findMinimalTypes(ret, {sources: sources})
    //     })
    //   }, [])

    function copyEnum (to, from, enumId) {
      let old = from.enums[enumId]
      if (old.id in to.enums) {
        return
      }

      let e = {
        id: old.id,
        name: old.name,
        values: old.values.slice(),
        packages: old.packages.slice()
      }
      addPackages(to, model, e.packages)
      to.enums[enumId] = e
    }

    function copyDatatype (to, from, datatypeId) {
      let old = from.datatypes[datatypeId]
      if (old.id in to.datatypes) {
        return
      }

      let e = {
        id: old.id,
        name: old.name,
        packages: old.packages.slice()
      }
      addPackages(to, model, e.packages)
      to.datatypes[datatypeId] = e
    }

    function addDependentClasses (classIds) {
      classIds.forEach(
        classId => {
          if (classId in ret.classes) { // a recursive walk of the superClasses
            return //                      may result in redundant insertions.
          }

          let old = model.classes[classId]
          let dependentClassIds = []
          let c = {
            id: old.id,
            name: old.name,
            properties: [],
            others: old.others.slice(),
            packages: old.packages.slice(),
            superClasses: old.superClasses.slice()
          } // was deepCopy(old)
          ret.classes[classId] = c
          old.properties.forEach(
            p => {
              let id = p.relation || p.attribute
              if (id in model.enums) {
                copyEnum(ret, model, id)
              }
              if (id in model.datatypes) {
                copyDatatype(ret, model, id)
              }
              if (id in model.classes) {
                dependentClassIds.push(id)
              }
              c.properties.push(addProperty(ret, c.name, c.id, p.name, p.relation, p.attribute, p.lower, p.upper))
            }
          )
          addPackages(ret, model, c.packages)
          c.superClasses.forEach(
            suClass =>
              ret.classHierarchy.add(suClass, c.id)
          )
          addDependentClasses(dependentClassIds.concat(c.superClasses))
        }
      )
    }

    function addPackages (to, from, packageIds) {
      for (let i = 0; i < packageIds.length; ++i) {
        let pid = packageIds[i]
        let old = from.packages[pid]
        let p = pid in to.packages ? to.packages[pid] : {
          name: old.name,
          id: pid,
          packages: old.packages.slice()
        }
        if (!(pid in to.packages)) {
          to.packages[pid] = p
        }
        if (i > 0) { // add [0],[1]  [1],[2]  [2],[3]...
          to.packageHierarchy.add(pid, packageIds[i - 1])
        }
      }
    }

    function includedSource (source) {
      // properties with a source in classIds
      return classIds.indexOf(source.in) !== -1
    }
  }

  function parseModel (document, triples) {
    // makeHierarchy.test()
    // convenience variables
    let packages = {}
    let classes = {}
    let properties = {}
    let enums = {}
    let datatypes = {}
    let classHierarchy = makeHierarchy()
    let packageHierarchy = makeHierarchy()

    let associations = {}
    let assocSrcToClass = {}

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
    visitPackage(document['xmi:XMI']['uml:Model'][0], [])

    // Turn associations into properties.
    Object.keys(associations).forEach(
      assocId => {
        let a = associations[assocId]
        let c = classes[assocSrcToClass[a.from]]
        let aref = c.associations[a.from]
        if (a.name !== 'realizes') {
          c.properties.push(addProperty(model, aref.name, aref.id, a.name, aref.type, undefined, aref.lower, aref.upper))
        }
      }
    )

    // Change relations to datatypes to be attributes.
    // Change relations to the classes and enums to reference the name.
    Object.keys(properties).forEach(
      p => properties[p].sources.forEach(
        s => {
          if (s.relation in datatypes) {
            // console.log('changing property ' + p + ' to have attribute type ' + datatypes[s.relation].name)
            // s.attribute = datatypes[s.relation].name
            s.attribute = s.relation
            s.relation = undefined
          } else if (s.relation in classes) {
            // s.relation = classes[s.relation].name
          } else if (s.relation in enums) {
            // s.relation = enums[s.relation].name
          }
        }))

    // Find set of types for each property.
    Object.keys(properties).forEach(propName => {
      let p = properties[propName]
      p.uniformType = findMinimalTypes(model, p)
    }, [])

    console.dir(model)
    return model

    function visitPackage (elt, parents) {
      let parent = parents[0]
      let type = elt.$['xmi:type']
      if ('xmi:id' in elt.$) {
        let id = elt.$['xmi:id']
        let name = parseName(elt)
        // Could keep id to elt map around with this:
        // index[id] = { element: elt, packages: parents }

        switch (type) {
          case 'uml:Class':
            if (id in classes) {
              throw Error('already seen class id ' + id)
            }
            let ownedAttrs = parseProperties(
              model, elt.ownedAttribute || [], // SentinelConceptualDomain has no props
              name, triples)

            classes[id] = Object.assign({
              id: id,
              name: name
            }, ownedAttrs, {
              packages: parents,
              superClasses: []
            })
            packages[parent].elements.push({type: 'class', id: id})
            Object.keys(ownedAttrs.associations).forEach(
              assocSourceId => { assocSrcToClass[assocSourceId] = id }
            )

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
              packages: parents
            }
            packages[parent].elements.push({type: 'enumeration', id: id})
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
              packages: parents
            }
            packages[parent].elements.push({type: 'datatype', id: id})
            // record class hierarchy
            if ('generalization' in elt) {
              throw Error("need to handle inherited datatype " + parseGeneral(elt.generalization[0]) + " " + name)
            }
            break
          case 'uml:Model':
          case 'uml:Package':
            let recurse = true
            if (id === 'ddi4_views') {
              model.views = parseEAViews(document['xmi:XMI']['xmi:Extension'][0]['diagrams'][0]['diagram'])
              recurse = false
              break // elide EA views package in package hierarcy
            }
            if (id.match(/FunctionalViews/)) {
              model.views = parseCanonicalViews(elt)
              recurse = false
              break // elide canonical views package in package hierarcy
            }
            packages[id] = {
              name: name,
              id: id,
              packages: parents,
              elements: []
            }
            if (parents.length && !id.match(/Pattern/)) { // don't record Pattern packages.
              packageHierarchy.add(parent, id)
              packages[parent].elements.push({type: 'package', id: id})
            }
            if (recurse) {
              // walk desendents
              let skipTheseElements = ['lowerValue', 'upperValue', 'generalization', 'type', 'name', 'isAbstract', 'URI', 'ownedLiteral']
              Object.keys(elt).filter(k => k !== '$' && skipTheseElements.indexOf(k) === -1).forEach(k => {
                elt[k].forEach(sub => {
                  visitPackage(sub, [id].concat(parents))
                })
              })
            }
            break
            // Pass through to get to nested goodies.
          case 'uml:Association':
            let from = elt.memberEnd.map(end => end.$['xmi:idref']).filter(id => id !== elt.ownedEnd[0].$['xmi:id'])[0]
            associations[id] = {
              id: id,
              name: name,
              from: from
              // type: elt.ownedEnd[0].type[0].$['xmi:idref']
            }
            /* <packagedElement xmi:id="AgentIndicator-member-association" xmi:type="uml:Association">
                 <name>member</name>
                 <memberEnd xmi:idref="AgentIndicator-member-source"/>
                 <memberEnd xmi:idref="AgentIndicator-member-target"/>
                 <ownedEnd xmi:id="AgentIndicator-member-target" xmi:type="uml:Property">
                   <association xmi:idref="AgentIndicator-member-association"/>
                   <type xmi:idref="AgentIndicator"/>
                   <lower><value>1</value></lowerValue>
                   <upper><value>1</value></uppervalue>
                 </ownedEnd>
               </packagedElement> */
            break
          default:
            console.warn('need handler for ' + type)
        }
      }
    }
  }

  function addProperty (model, className, id, name, relation, attribute, lower, upper) {
    let propertyRecord = {
      in: className,
      id: id,
      name: name,
      relation: relation,
      attribute: attribute,
      lower: lower,
      upper: upper
    }
    if (propertyRecord.upper === '-1') {
      propertyRecord.upper = UPPER_UNLIMITED
    }
    if (!(name in model.properties)) {
      model.properties[name] = {sources: []}
    }
    model.properties[name].sources.push(propertyRecord)
    return propertyRecord
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
    let shexh = []

    function OWLXMLMarkup () {
      return {
        // only needed for section markers
        startPackage: function (p) { return '    <!-- START ' + p.name + ' Package -->\n' },
        endPackage: function (p) { return '\n    <!-- END ' + p.name + ' Package -->\n' }
      }
    }
    function ShExCMarkup () {
      return {
        definition: name => pname(name),
        docLink: link => ' // rdfs:definedBy <' + link + '>',
        reference: name => pname(name),
        constant: name => pname(name),
        property: name => pname(name),
        valueType: name => pname(name),
        valueReference: name => name === '.' ? '.' : '@' + pname(name),
        startPackage: function (p) { return '# START ' + p.name + ' Package\n' },
        endPackage: function (p) { return '\n# END ' + p.name + ' Package\n' }
      }
    }
    function ShExHMarkup () {
      return {
        definition: name => `      <section>
        <h3>${name}</h3>
        <div class="example wrapper">
        <pre class="nohighlight schema shexc tryable">
<span class="shape-name">ddi:<dfn>${name}</dfn></span>`,
        docLink: link => `<a class="tryit" href="${link}">lion</a></pre>
      </div>
      </section>`,
        reference: name => ref(pname(name)),
        constant: name => pOrT(pname(name)),
        property: name => pOrT(pname(name)),
        valueType: name => pOrT(pname(name)),
        valueReference: name => name === '.' ? '.' : '@' + ref(pname(name)),
        startPackage: function (p) { return '    <section>\n      <h2>' + p.name + '</h2>\n\n' },
        endPackage: function (p) { return '    </section>\n' }
      }

      function ref (term) {
        let i = term.indexOf(':') + 1
        return '<span class="shape-name">' + term.substr(0, i) + '<a>' + term.substr(i) + '</a></span>'
      }

      function pOrT (term) {
        let i = term.indexOf(':') + 1
        return '<span class="type">' + term.substr(0, i) + '</span><span class="constant">' + term.substr(i) + '</span>'
      }
    }

    // Missing classes -- expected to be repaired.
    let missingClasses = ['CatalogItem', 'AnalyticMetadatum', 'CommonDataElement', 'DataCollection', 'LogicalResource', 'LogicalSegment', 'PhysicalSegment']
    missingClasses.forEach(
      classId => {
        if (!(classId in model)) { // !!
          model.classes[classId] = { name: classId, packages: ['FooPattern'] }
        }
      })

    let packages = firstBranch(model.packageHierarchy.roots)

    let toRender = [
      { v: owlx, s: OWLXMLSerializer(model), m: OWLXMLMarkup() },
      { v: shexc, s: ShExCSerializer(model), m: ShExCMarkup() },
      { v: shexh, s: ShExCSerializer(model), m: ShExHMarkup() }
    ]
    toRender.forEach(
      r => {
        Array().push.apply(r.v, Object.keys(packages).map(
          packageId => renderPackage(model.packages[packageId], r.s, r.m)
        ))
      })

    // Render package hierarchy.
    Array().push.apply(owlx, Object.keys(packages).map(
      p => `    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.packages[p].name}_Package"/>
        <Class abbreviatedIRI="ddi:Packages"/>
    </SubClassOf>`
    ))

    // Render view hierarchy.
    if ('views' in model) {
      Array().push.apply(owlx, model.views.reduce(
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
    Array().push.apply(owlx, Object.keys(model.properties).filter(propName => !(isPolymorphic(propName))).map(
      propName => {
        let p = model.properties[propName]
        let t = isObject(p) ? 'Object' : 'Data'
        let src = p.sources[0]
        let dt = isObject(p)
          ? src.relation in model.classes ? model.classes[src.relation] : model.enums[src.relation]
          : src.attribute in model.datatypes ? model.datatypes[src.attribute] : { name: src.attribute }
        return `    <Declaration>
        <${t}Property abbreviatedIRI="ddi:${propName}"/>
    </Declaration>
    <${t}PropertyRange>
        <${t}Property abbreviatedIRI="ddi:${propName}"/>
        <${isObject(p) ? "Class" : "Datatype"} abbreviatedIRI="${pname(dt.name)}"/>
    </${t}PropertyRange>`
      }
    ))

    Array().push.apply(owlm, Object.keys(model.properties).filter(propName => !(isPolymorphic(propName))).map(
      propName => {
        let p = model.properties[propName]
        let t = isObject(p) ? 'Object' : 'Data'
        return t + 'Property: ddi:' + propName + ' Range: ' + pname(p.uniformType[0])
      }
    ))

    Array().push.apply(owlm, Object.keys(model.classes).filter(
      classId => !model.classes[classId].packages[0].match(/Pattern/)
    ).map(
      classId => 'Class: ddi:' + classId + ' SubClassOf:\n' +
        model.classes[classId].properties.map(
          propertyRecord => {
            let propName = propertyRecord.name
            let type = isPolymorphic(propName) ? 'owl:Thing' : pname(model.properties[propName].uniformType[0])
            return '  ddi:' + propName + ' only ' + type
          }
        ).join(',\n')
    ))

    // Terminate the various forms:
    Array().push.apply(owlx, [
      '</Ontology>\n'
    ])
    let ret = {owlx: owlx, owlm: owlm, shexc: shexc, shexh: shexh}
    console.dir(ret)
    return ret

    function isPolymorphic (propName) {
      return model.properties[propName].uniformType.length !== 1 ||
        model.properties[propName].uniformType[0] === undefined
    }

    function renderPackage (pkg, serializer, markup) {
      return markup.startPackage(pkg) +
        pkg.elements.map(
          entry => {
            switch (entry.type) {
              // Not needed since the package space is flat:
              // case 'package':
              //   return model.packages[entry.id].map(
              //     packageId => renderPackage(packageId, serializer, markup)
              //   ).join('\n')
              //   break
              case 'class':
                return serializer.class(model, entry.id, markup)
              case 'enumeration':
                return serializer.enum(model, entry.id, markup)
              case 'datatype':
                return serializer.datatype(model, entry.id, markup)
              default:
                throw Error('need renderPackage handler for ' + entry.type)
            }
          }
        ).join('\n\n') +
        markup.endPackage(pkg)
    }
  }

  function OWLXMLSerializer (model) {
    return {
      class: OWLXMLClass,
      enum: OWLXMLEnum,
      datatype: OWLXMLDatatype
    }

    function isPolymorphic (propName) {
      return model.properties[propName].uniformType.length !== 1 ||
        model.properties[propName].uniformType[0] === undefined
    }

    function OWLXMLClass (model, classId) {
      return `    <Declaration>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>
    </Declaration>\n` +
        model.classes[classId].properties.filter(
          propertyRecord => !(isPolymorphic(propertyRecord.name))
        ).map(
          propertyRecord => {
            let propName = propertyRecord.name
            let p = model.properties[propName]
            let t = isObject(p) ? 'Object' : 'Data'
            let dt = isObject(p)
              ? propertyRecord.relation in model.classes ? model.classes[propertyRecord.relation] : model.enums[propertyRecord.relation]
              : propertyRecord.attribute in model.datatypes ? model.datatypes[propertyRecord.attribute] : { name: propertyRecord.attribute }
            let type = isPolymorphic(propName) ? 'owl:Thing' : pname(dt.name)
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
            supercl =>
              SUPPRESS_DUPLICATE_CLASSES && // if some superclass appears in the same package...
              model.classes[classId].packages[0] === model.classes[supercl].packages[0]
          )
            ? [] //       ... skip that package
            : [`    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>
        <Class abbreviatedIRI="ddi:${model.packages[model.classes[classId].packages[0]].name}_Package"/>
    </SubClassOf>`
            ]).join('\n')
    }

    function OWLXMLEnum (model, enumId) {
      return [].concat(
        `    <EquivalentClasses>
    <Class abbreviatedIRI="ddi:${model.enums[enumId].name}"/>
        <ObjectOneOf>`,
        model.enums[enumId].values.map(
          v => `            <NamedIndividual abbreviatedIRI="ddi:${v}"/>`
        ),
        `       </ObjectOneOf>
    </EquivalentClasses>
    <SubClassOf>
        <Class abbreviatedIRI="ddi:${model.enums[enumId].name}"/>
        <Class abbreviatedIRI="ddi:${model.packages[model.enums[enumId].packages[0]].name}_Package"/>
    </SubClassOf>`).join('\n')
    }

    function OWLXMLDatatype (model, datatypeId) {
      let dt = model.datatypes[datatypeId]
      if (dt.name.startsWith('http://www.w3.org/2001/XMLSchema#') ||
          dt.name.startsWith('http://www.w3.org/XML/1998/namespace#')) {
        return ''
      }
      return [].concat(
        `    <DatatypeDefinition>
        <Datatype abbreviatedIRI="${pname(dt.name)}"/>
        <Datatype abbreviatedIRI="xsd:string"/>
    </DatatypeDefinition>`).join('\n')
    }
  }

  function ShExCSerializer (model) {
    return {
      class: ShExCClass,
      enum: ShExCEnum,
      datatype: ShExCDatatype
    }

    function ShExCClass (model, classId, markup) {
      let classRecord = model.classes[classId]
      return markup.definition(classRecord.name) +
        classRecord.superClasses.map(
          su => model.classes[su].name
        ).map(
          name => " EXTENDS " + markup.reference(name)
        ).join('') +
        ' {\n' +
        classRecord.properties.map(
          propertyRecord => {
            let propName = propertyRecord.name
            let p = model.properties[propName]
            let use = p.sources.find(s => s.id.indexOf(classId) === 0)
            let dt = isObject(p)
              ? use.relation in model.classes ? model.classes[use.relation] : model.enums[use.relation]
              : use.attribute in model.datatypes ? model.datatypes[use.attribute] : { name: use.attribute }
            if (dt === undefined) {
              console.warn('unresolved datatype ' + use.relation + ' for property ' + propName)
              dt = {name: '.'} // replace with a ShExC wildcard to keep the schema coherent.
            }
            let card = shexCardinality(use)
            return '  ' + markup.property(propName) + ' ' + (isObject(p) ? markup.valueReference(dt.name) : markup.valueType(dt.name)) + ' ' + card + ';\n'
          }
        ).join('') + '}' + markup.docLink(docURL(classRecord.name))
    }

    function ShExCEnum (model, enumId, markup) {
      return markup.definition(model.enums[enumId].name) + ' [\n' + model.enums[enumId].values.map(
        v => '  ' + markup.constant(v) + '\n'
      ).join('') + ']' + markup.docLink(docURL(model.enums[enumId].name))
    }

    function ShExCDatatype (model, datatypeId, markup) {
      let dt = model.datatypes[datatypeId]
      if (dt.name.startsWith('http://www.w3.org/2001/XMLSchema#') ||
          dt.name.startsWith('http://www.w3.org/XML/1998/namespace#')) {
        return ''
      }
      return markup.definition(dt.name) + ' xsd:string' + markup.docLink(docURL(dt.name))
    }

    function shexCardinality (propertyRecord) {
      let lower = parseInt(propertyRecord.lower || 0)
      let upper = propertyRecord.upper && propertyRecord.upper !== '*' ? parseInt(propertyRecord.upper) : -1
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

  /** find the unique object types for a property
   */
  function findMinimalTypes (model, p) {
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

  function deepCopy (obj) {
    return JSON.parse(JSON.stringify(obj)) // startlingly efficient
  }

  function emptyObject (obj) {
    for (var x in obj) { return false }
    return true
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
