// Convert DDI XMI to OWL and ShEx

// Global configuration and control variables.
var TOGGLE_TIME = 50 // time in μsec to toggle collapsed lists.
var RENDER_DELAY = 10 // time to pause for display (horrible heuristics). Could try: .css('opacity', .99)
var BUILD_PRODUCTS = true // can disable if OWL and ShEx construction crashes.
var SUPPRESS_DUPLICATE_CLASSES = true // Don't list subclasses in parent's package.
var UPPER_UNLIMITED = '*'

function main () {
  const AllRecordTypes = [
    {type: ModelRecord,       maker: () => $('<span/>', { class: 'record' }).text('model'  )},
    {type: PropertyRecord,    maker: () => $('<span/>', { class: 'record' }).text('prop'   )},
    {type: ClassRecord,       maker: () => $('<span/>', { class: 'record' }).text('Class'  )},
    {type: PackageRecord,     maker: () => $('<span/>', { class: 'record' }).text('Package')},
    {type: EnumRecord,        maker: () => $('<span/>', { class: 'record' }).text('Enum'   )},
    {type: DatatypeRecord,    maker: () => $('<span/>', { class: 'record' }).text('Dt'     )},
    {type: ViewRecord,        maker: () => $('<span/>', { class: 'record' }).text('View'   )},
    {type: AssociationRecord, maker: () => $('<span/>', { class: 'record' }).text('Assoc'  )},
    {type: AssocRefRecord,    maker: () => $('<span/>', { class: 'record' }).text('assoc'  )},
    {type: RefereeRecord,     maker: () => $('<span/>', { class: 'record' }).text('ref'    )}
  ]

  function docURL (term) {
    return 'http://lion.ddialliance.org/ddiobjects/' + term.toLowerCase()
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

  function parseComments (elt) {
    return 'ownedComment' in elt
      ? elt.ownedComment.map( commentElt => commentElt.body[0] )
      : []
  }

  function parseIsAbstract (elt) {
    return 'isAbstract' in elt.$ ? elt.$.isAbstract === 'true' : 'isAbstract' in elt ? elt.isAbstract[0] === 'true' : false
  }

  function parseProperties (model, elts, className) {
    let ret = {
      properties: [],
      associations: {},
      comments: []
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
        ret.associations[id] = Object.assign(new AssocRefRecord(id, name), {
          in: className,
          type: elt.type[0].$['xmi:idref'],
          lower: parseValue(elt.lowerValue[0], 0),
          upper: parseValue(elt.upperValue[0], UPPER_UNLIMITED),
          comments: parseComments(elt)
        })
      } else if (!name) {
        // e.g. canonical *-owned-attribute-n properties.
        // throw Error('expected name in ' + JSON.stringify(elt.$) + ' in ' + parent)
      } else if (name.charAt(0).match(/[A-Z]/)) {
        throw Error('unexpected property name ' + name + ' in ' + className)
      } else {
        ret.properties.push(
          new PropertyRecord(
            model, className, id, name, elt.type[0].$['xmi:idref'],
            normalizeType(elt.type[0].$['href'] || elt.type[0].$['xmi:type']),
            parseValue(elt.lowerValue[0], 0),
            parseValue(elt.upperValue[0], UPPER_UNLIMITED),
            parseComments(elt))
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
        return Object.assign(new ViewRecord(), {
          id: diagram['$']['xmi:id'],
          name: diagram.model[0].$.package,
          members: diagram.elements[0].element.map(
            member => member.$.subject
          )
        })
      }
    )
  }

  function parseCanonicalViews (elt) {
    return elt.packagedElement.map(view => {
      return Object.assign(new ViewRecord(), {
        id: view.$['xmi:id'],
        name: parseName(view),
        members: view.elementImport.map(
          imp => imp.importedElement[0].$['xmi:idref']
        )
      })
    })
  }

  function normalizeType (type) {
    if (!type) {
      return type // pass undefined on
    }
    if (type === 'xs:language') {
      return 'http://www.w3.org/2001/XMLSchema#language'
    }
    let nameMap = {
      'http://schema.omg.org/spec/UML/2.1/uml.xml#String': 'http://www.w3.org/2001/XMLSchema#string',
      'http://schema.omg.org/spec/UML/2.1/uml.xml#Integer': 'http://www.w3.org/2001/XMLSchema#integer',
      'http://schema.omg.org/spec/UML/2.1/uml.xml#Boolean': 'http://www.w3.org/2001/XMLSchema#boolean',
      'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#String': 'http://www.w3.org/2001/XMLSchema#string',
      'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#Integer': 'http://www.w3.org/2001/XMLSchema#integer',
      'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#Boolean': 'http://www.w3.org/2001/XMLSchema#boolean',
      'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#Real': 'http://www.w3.org/2001/XMLSchema#double',
      'http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#UnlimitedNatural': 'http://www.w3.org/2001/XMLSchema#double'
    }
    if (type in nameMap) {
      return nameMap[type]
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
        let status = $('<span/>').addClass('status').text('loading...')
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
            processXMI(loadEvent.target.result, 'uploaded ' + file.name + ' ' + new Date().toISOString(), status)
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
    let status = $('<span/>').addClass('status').text('fetching...')
    $('<h2/>').append(source, status).appendTo(div)
    window.fetch(source).then(function (response) {
      if (!response.ok) {
        throw Error('got ' + response.status + ' ' + response.statusText)
      }
      return response.text()
    }).then(function (text) {
      window.setTimeout(() => {
        $('<textarea/>', {cols: 60, rows: 10}).val(text).appendTo(div)
        processXMI(text, 'fetched ' + source + ' ' + new Date().toISOString(), status)
      }, RENDER_DELAY)
    }).catch(function (error) {
      div.append($('<pre/>').text(error)).addClass('error')
    })
    return true
  })

  function processXMI (xmiText, source, status) {
    let div = $('<div/>', {'id': source, 'class': 'result'}).appendTo('#render')
    let reparse = $('<button/>').text('reparse').on('click', parse)
    $('<h2/>').text(source).append(reparse).appendTo(div)
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
      model = parseModel(document, source)
      status.text('rendering structure...')
      window.setTimeout(render, RENDER_DELAY)
    }

   function render () {
      let modelUL = $('<ul/>')
      structureToListItems(model, modelUL, AllRecordTypes)
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
      let allViews = strip(model, source, model.views.map(v => v.name))
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
      let t = dumpFormats(model, source,
                          $('#nestInlinableStructure').is(':checked'))
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
          $('<a/>', {href: ''}).text('HTML').on('click', () => download(t.shexh.join('\n\n'), 'text/html', 'ddi.shex.html'))
        )
      )

      console.log('model', model, Object.keys(model.classes).length, Object.keys(model.properties).length)
      model.views.map(v => v.name).forEach(
        viewName => {
          let s = strip(model, source, viewName,
                        $('#followReferencedClasses').is(':checked'),
                        $('#followReferentHierarchy').is(':checked'))
        }
      )
    }
  }

  function strip (model, source, viewLabels, followReferencedClasses, followReferentHierarchy, nestInlinableStructure) {
    if (viewLabels.constructor !== Array) {
      viewLabels = [viewLabels]
    }

    let ret = Object.assign(new ModelRecord(), {
      source: source + viewLabels.join('-'),
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
    })

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
    addDependentClasses(classIds, true)

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

    function addDependentClasses (classIds, followParents) {
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
            comments: old.comments.slice(),
            packages: old.packages.slice(),
            superClasses: old.superClasses.slice(),
            isAbstract: old.isAbstract
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
              if (followReferencedClasses && id in model.classes) {
                dependentClassIds.push(id)
              }
              c.properties.push(new PropertyRecord(ret, c.id, p.id, p.name, p.relation, p.attribute, p.lower, p.upper))
            }
          )
          addPackages(ret, model, c.packages)
          c.superClasses.forEach(
            suClass =>
              ret.classHierarchy.add(suClass, c.id)
          )
          let x = dependentClassIds
          if (followParents)
            x = x.concat(c.superClasses)
          addDependentClasses(x, followReferentHierarchy)
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

  function parseModel (document, source, triples) {
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
    let model = Object.assign(new ModelRecord(), {
      source: source,
      packages: packages,
      classes: classes,
      properties: properties,
      enums: enums,
      datatypes: datatypes,
      classHierarchy: classHierarchy,
      packageHierarchy: packageHierarchy,
      associations: associations
    })

    // Build the model
    visitPackage(document['xmi:XMI']['uml:Model'][0], [])

    // Turn associations into properties.
    Object.keys(associations).forEach(
      assocId => {
        let a = associations[assocId]
        let c = classes[assocSrcToClass[a.from]]
        let aref = c.associations[a.from]
        let name = aref.name || a.name // if a reference has no name used the association name
        if (a.name !== 'realizes') {
          c.properties.push(new PropertyRecord(model, aref.in, aref.id, name, aref.type, undefined, aref.lower, aref.upper, aref.comments))
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
      p.sources.forEach(s => {
        let t = s.attribute || s.relation
        let referent =
              t in classes ? classes[t] :
              t in enums ? enums[t] :
              t in datatypes ? datatypes[t] :
              null
        if (referent) {
          referent.referees.push(new RefereeRecord(s.in, propName))
        } else {
          // console.warn('referent not found: ' + referent)
        }
      }, [])
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
              id, triples)

            classes[id] = Object.assign(
              new ClassRecord(id, name),
              ownedAttrs, {
                packages: parents,
                superClasses: [],
                isAbstract: parseIsAbstract(elt),
                referees: [],
                comments: parseComments(elt)
              }
            )
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
            enums[id] = Object.assign(new EnumRecord(), {
              id: id,
              name: name,
              values: elt.ownedLiteral.map(
                l => parseName(l)
              ),
              packages: parents,
              referees: []
            })
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
            datatypes[id] = Object.assign(new DatatypeRecord(), {
              name: name,
              id: id,
              packages: parents,
              referees: []
            })
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
            packages[id] = Object.assign(new PackageRecord(), {
              name: name,
              id: id,
              packages: parents,
              elements: []
            })
            if (parents.length && !id.match(/Pattern/)) { // don't record Pattern packages.
              packageHierarchy.add(parent, id)
              packages[parent].elements.push({type: 'package', id: id})
            }
            if (recurse && 'packagedElement' in elt) {
              // walk desendents
              elt.packagedElement.forEach(sub => {
                visitPackage(sub, [id].concat(parents))
              })
            }
            break
            // Pass through to get to nested goodies.
          case 'uml:Association':
            let from = elt.memberEnd.map(end => end.$['xmi:idref']).filter(id => id !== elt.ownedEnd[0].$['xmi:id'])[0]
            associations[id] = Object.assign(new AssociationRecord(id, name), {
              from: from
              // type: elt.ownedEnd[0].type[0].$['xmi:idref']
            })
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

  function ClassRecord (id, name) {
    this.id = id
    this.name = name
  }

  function PropertyRecord (model, className, id, name, relation, attribute, lower, upper, comments) {
    if (className === null) {
      console.warn('no class name for PropertyRecord ' + id)
    }
    this.in = className
    this.id = id
    this.name = name
    this.relation = relation
    this.attribute = attribute
    this.lower = lower
    this.upper = upper
    this.comments = comments
    if (this.upper === '-1') {
      this.upper = UPPER_UNLIMITED
    }
    if (!(name in model.properties)) {
      model.properties[name] = {sources: []}
    }
    model.properties[name].sources.push(this)
  }

  function RefereeRecord     (classId, propName) {
    // if (classId === null) {
    //   throw Error('no class id for ReferenceRecord with property name ' + propName)
    // }
    this.classId = classId
    this.propName = propName
  }
  function ModelRecord       () { }
  function PackageRecord     () { }
  function EnumRecord        () { }
  function DatatypeRecord    () { }
  function ViewRecord        () { }

  /**
   * if attrName is null, we'll use the AssociationRecord's name.
        <packagedElement xmi:id="<classId>" xmi:type="uml:Class">
          <ownedAttribute xmi:id="<classId>-ownedAttribute-<n>" xmi:type="uml:Property">
            <type xmi:idref="<refType>"/> <lowerValue/> <upperValue/>
            <name>attrName</name>
          </ownedAttribute>
        </packagedElement>
   */
  function AssocRefRecord (id, name) {
    // if (name === null) {
    //   throw Error('no name for AssociationRecord ' + id)
    // }
    this.id = id
    this.name = name
  }

  /**
        <packagedElement xmi:id="<classId>" xmi:type="uml:Association"> <!-- can duplicate classId -->
          <memberEnd xmi:idref="<classId>-ownedAttribute-<n>"/>
          <memberEnd xmi:idref="<classId>-ownedEnd"/>
          <ownedEnd xmi:id="<classId>-ownedEnd" xmi:type="uml:Property">
            <type xmi:idref="<classId>"/> <lowerValue /> <upperValue />
            <association xmi:idref="<classId>"/>
          </ownedEnd>
          <name>assocName</name>
        </packagedElement>
   */
  function AssociationRecord (id, name) {
    // if (name === null) {
    //   throw Error('no name for AssociationRecord ' + id)
    // }
    this.id = id
    this.name = name
  }

  function reusedProperties (classes, into) {
    const x = Object.keys(classes).reduce((acc, classId) => {
      classes[classId].properties.forEach(
        field => {
          if (!(field.name in acc.seen)) {
            acc.seen[field.name] = [classId]
          } else {
            acc.seen[field.name].push(classId)
            if (acc.duplicates.indexOf(field.name) === -1) {
              acc.duplicates.push(field.name)
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

  function dumpFormats (model, source, nestInlinableStructure) {
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
        '    <Prefix name="rdfs" IRI="http://www.w3.org/2000/01/rdf-schema#"/>\n'
    ]
    let owlm = [
      'Prefix: ddi: <http://ddi-alliance.org/ns/#>\n' +
        'Prefix: xsd: <http://www.w3.org/2001/XMLSchema#>\n' +
        'Prefix: rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n' +
        'Ontology: <http://ddi-alliance.org/ddi-owl>\n' +
        '\n'
    ]
    let shexc = [
      '# Source: ' + source + '\n' +
        'PREFIX ddi: <http://ddi-alliance.org/ns/#>\n' +
        'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n' +
        'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n' +
        'PREFIX shexmi: <http://www.w3.org/ns/shex-xmi#>\n' +
        'PREFIX mark: <https://github.com/commonmark/commonmark.js>\n' +
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
    function stringEscape (str) {
      return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }
    function ShExCMarkup () {
      return {
        definition: (rec) => (rec.isAbstract ? 'ABSTRACT ' : '') + pname(rec.name),
        docLink: link => '// rdfs:definedBy <' + link + '>',
        packageStr: pkg => '// shexmi:package "' + stringEscape(pkg) + '"',
        comment: txt => '// shexmi:comment """' + stringEscape(txt) + '"""',
        reference: name => pname(name),
        constant: name => pname(name),
        property: name => pname(name),
        valueType: name => pname(name),
        valueReference: name => name === '.' ? '.' : '@' + pname(name),
        startPackage: function (p) { return '# START ' + p.name + ' Package\n' },
        endPackage: function (p) { return '\n# END ' + p.name + ' Package\n' }
      }
    }
    function ShExHMarkup (model) {
      return {
        definition: (rec) => `      <section>
        <h3>${rec.name}</h3>
        <div>
          <p>${rec.referees.length === 0 ? 'no references' : '' + rec.referees.length + ' reference' + (rec.referees.length > 1 ? 's' : '') + ':'}</p>
          ${rec.referees.length ? `<div class="left-scroll"><ul class="referees">
${rec.referees.map(r => `            <li><a>${finalReferee(r.classId).name}</a> ${r.propName}</li>\n`).join('')}
          </ul></div>` : ''}
        </div>
        <div class="example wrapper">
        <pre class="nohighlight schema shexc tryable">
${rec.isAbstract ? 'ABSTRACT ' : ''}<span class="shape-name">ddi:<dfn>${rec.name}</dfn></span>`,
        docLink: link => `<a class="tryit" href="${link}"></a></pre>
      </div>
      </section>`,
        packageStr: pkg => '',
        comment: txt => '',
        reference: name => ref(pname(name)),
        constant: name => pOrT(pname(name)),
        property: name => pOrT(pname(name)),
        valueType: name => pOrT(pname(name)),
        valueReference: name => name === '.' ? '.' : '@' + ref(pname(name)),
        startPackage: function (p) { return '    <section>\n      <h2>' + p.name + '</h2>\n\n' },
        endPackage: function (p) { return '\n    </section>\n' }
      }

      function finalReferee (classId) {
        while (nestInlinableStructure && inlineable(model, model.classes[classId])) {
          if (classId === model.classes[classId].referees[0].classId) {
            debugger
            break
          }
          classId = model.classes[classId].referees[0].classId
        }
        return model.classes[classId]
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
      { v: shexc, s: ShExCSerializer(model, nestInlinableStructure), m: ShExCMarkup() },
      { v: shexh, s: ShExCSerializer(model, nestInlinableStructure), m: ShExHMarkup(model) }
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
        (model.classes[classId].isAbstract ? (
          `    <DisjointUnion>
        <Class abbreviatedIRI="ddi:${model.classes[classId].name}"/>\n` + model.classHierarchy.children[classId].map(
            childClassId =>
              `        <Class abbreviatedIRI="ddi:${model.classes[childClassId].name}"/>\n`
          ).join('') +
          `    </DisjointUnion>\n`
        ) : '') +
        model.classes[classId].properties
        // .filter( propertyRecord => !(isPolymorphic(propertyRecord.name)) )
        .map(
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

  function inlineable (model, classRecord) {
    return classRecord.referees.length === 1
      && (!(classRecord.id in model.classHierarchy.children)
          || model.classHierarchy.children[classRecord.id].length === 0)
  }

  function ShExCSerializer (model, nestInlinableStructure) {
    return {
      class: ShExCClass,
      enum: ShExCEnum,
      datatype: ShExCDatatype
    }

    function ShExCClass (model, classId, markup, force) {
      let classRecord = model.classes[classId]
      if (!force && nestInlinableStructure && inlineable(model, classRecord)) {
        return ''
      }
      return (force
              ? ''
              : markup.definition(classRecord)) +
        classRecord.superClasses.map(
          su => model.classes[su].name
        ).map(
          name => ' EXTENDS ' + markup.reference(name)
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
            let comments = (use.comments || []).map(markup.comment)
            let valueStr =
                  'referees' in dt && dt instanceof ClassRecord && nestInlinableStructure && inlineable(model, dt)
                  ? indent(ShExCClass(model, dt.id, markup, true), '  ')
                  : isObject(p)
                  ? markup.valueReference(dt.name)
                  : markup.valueType(dt.name)
            return '  ' + markup.property(propName) + ' ' + valueStr +
              (card ? ' ' + card : '') +
              comments.map(
                comment => '\n  ' + comment
              ).join('') + ';\n'
          }
        ).join('') + '}' +
        (force ? '' : '\n' + markup.docLink(docURL(classRecord.name))) +
        (force || classRecord.packages.length === 0 ? '' : '\n' + markup.packageStr(model.packages[classRecord.packages[0]].name)) +
        (force || classRecord.comments.length === 0 ? '' : '\n' + markup.comment(classRecord.comments[0]) + '^^mark:')

      function indent (s, lead) {
        let a = s.split(/\n/)
        return a[0].replace(/^ /, '') + '\n'
          + a.slice(1, a.length - 1).map(
            line => line.replace(/^/g, lead) + '\n'
          ).join('')
          + lead + a[a.length - 1]
      }
    }

    function ShExCEnum (model, enumId, markup) {
      return markup.definition(model.enums[enumId]) + ' [\n' + model.enums[enumId].values.map(
        v => '  ' + markup.constant(v) + '\n'
      ).join('') + ']' + '\n' + markup.docLink(docURL(model.enums[enumId].name))
    }

    function ShExCDatatype (model, datatypeId, markup) {
      let dt = model.datatypes[datatypeId]
      if (dt.name.startsWith('http://www.w3.org/2001/XMLSchema#') ||
          dt.name.startsWith('http://www.w3.org/XML/1998/namespace#')) {
        return ''
      }
      return markup.definition(dt) + ' xsd:string' + '\n' + markup.docLink(docURL(dt.name))
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

  function structureToListItems (object, into, recordTypes) {
    into.append(Object.keys(object).filter(
      k => typeof object[k] !== 'function'
    ).map(k => {
      let elt = object[k]
      let typeIcon = ''
      let title = object.constructor === Array
        ? ''
        : k
      let value
      if (elt === null) {
        title += ':'
        value = $('<span/>').addClass('keyword').text('NULL')
      } else if (typeof elt === 'boolean') {
        title += ':'
        value = $('<span/>').addClass('keyword').text(elt)
      } else if (typeof elt === 'object') {
        let delims = ['{', '}']
        if (elt.constructor === Array) {
          let delims = ['[', ']']
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
        typeIcon = recordTypes.find(rt => elt instanceof rt.type)
        if (typeIcon === undefined) {
          typeIcon = ''
          title += ' ' + delims[0] + Object.keys(elt).length + delims[1]
        } else {
          typeIcon = typeIcon.maker()
        }
        value = $('<ul/>')
        structureToListItems(elt, value, recordTypes)
      } else {
        if (object.constructor !== Array) {
          title += ':'
        }
        value = !elt
          ? ''
          : $(elt.match(/\n/) ? '<pre/>' : '<span/>').addClass('scalar').text(elt)
      }
      into.append($('<li/>').append(typeIcon, title, value))
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
