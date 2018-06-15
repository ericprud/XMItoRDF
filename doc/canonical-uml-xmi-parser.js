/**
 */

let CanonicalUmlXmiParser = function (opts) {

  let NormalizeType = opts.normalizeType || (type => type)
  let ViewPattern = opts.viewPattern || null
  let NameMap = opts.nameMap || { }
  let AGGREGATION_shared = 'AGGREGATION_shared'
  let AGGREGATION_composite = 'AGGREGATION_composite'
  var UPPER_UNLIMITED = '*'

  function parseName (elt) {
    let ret = 'name' in elt.$ ? elt.$.name : 'name' in elt ? elt.name[0] : null
    return !ret ? ret : ret in NameMap ? NameMap[ret] : expandPrefix(ret)
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

  function parseProperties (model, elts, classId) {
    let ret = {
      properties: [],
      associations: {},
      comments: []
    }
    elts.forEach(elt => {
      let umlType = elt.$['xmi:type']
      console.assert(umlType === 'uml:Property')
      let id = elt.$['xmi:id']
      let name = parseName(elt)
      let association = parseAssociation(elt)
      let newPropertyRec = new PropertyRecord(
        model, classId, id, name, elt.type[0].$['xmi:idref'],
        NormalizeType(elt.type[0].$['href']),
        parseValue(elt.lowerValue[0], 0),
        parseValue(elt.upperValue[0], UPPER_UNLIMITED),
        parseComments(elt))
      ret.properties.push(newPropertyRec)

      if (association) {
        /* <ownedAttribute xmi:type="uml:Property" name="AgentIndicator" xmi:id="AgentIndicator_member_source" association="AgentIndicator_member_association">
             <type xmi:idref="Agent"/>
             <lowerValue xmi:type="uml:LiteralInteger" xmi:id="AgentIndicator_member_lower"/>
             <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="AgentIndicator_member_upper" value="-1"/>
           </ownedAttribute> */
        ret.associations[id] = Object.assign(new AssocRefRecord(id, name), {
          propertyRecord: newPropertyRec,
          classId: classId,
          type: elt.type[0].$['xmi:idref'],
          lower: parseValue(elt.lowerValue[0], 0),
          upper: parseValue(elt.upperValue[0], UPPER_UNLIMITED),
          comments: parseComments(elt)
        }, ('aggregation' in elt ? {
          aggregation: (elt.aggregation[0] === "shared"
                        ? AGGREGATION_shared
                        : elt.aggregation[0] === "composite"
                        ? AGGREGATION_composite
                        : elt.aggregation[0]) // unknown aggregation state.
        } : { }))
      } else if (!name) {
        // e.g. canonical *-owned-attribute-n properties.
        // throw Error('expected name in ' + JSON.stringify(elt.$) + ' in ' + parent)
      } else if (name.charAt(0).match(/[A-Z]/)) {
        throw Error('unexpected property name ' + name + ' in ' + classId)
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
        ),
        comments: (view.ownedComment || []).map(
          cmnt => cmnt.body[0]
        )
      })
    })
  }

  function parseModel (document, source) {
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
    debugger;
    // Turn associations into properties.
    Object.keys(associations).forEach(
      assocId => {
        let a = associations[assocId]
        let c = classes[assocSrcToClass[a.from]]
        let aref = c.associations[a.from]
        let name = aref.name || a.name // if a reference has no name used the association name
        if (true || a.name !== 'realizes') { // @@@ DDI-specific
          let prec = new PropertyRecord(model, aref.classId, aref.id, name, aref.type, undefined, aref.lower, aref.upper, aref.comments.concat(a.comments));
          if ('aggregation' in aref) {
            prec.aggregation = aref.aggregation;
          }

          // update aref.propertyRecord
          aref.propertyRecord.name = name
          aref.propertyRecord.comments = prec.comments
        }
      }
    )

    // Change relations to datatypes to be attributes.
    // Change relations to the classes and enums to reference the name.
/*    Object.keys(properties).forEach(
      p => properties[p].sources.forEach(
        s => {
          if (s.idref in datatypes) {
            // console.log('changing property ' + p + ' to have attribute type ' + datatypes[s.idref].name)
            // s.href = datatypes[s.idref].name
            s.href = s.idref
            s.idref = undefined
          } else if (s.idref in classes) {
            // s.idref = classes[s.idref].name
          } else if (s.idref in enums) {
            // s.idref = enums[s.idref].name
          }
        }))
*/
    /*
     idref => idref in datatypes ? NodeConstraint : ShapeRef
     href => NodeConstraint
     type => NodeConstraint
     */

    updateReferees(model)

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
              id)

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
          /* obsolete special code for DDI EA view
            if (id === 'ddi4_views') {
              model.views = parseEAViews(document['xmi:XMI']['xmi:Extension'][0]['diagrams'][0]['diagram'])
              recurse = false
              break // elide EA views package in package hierarcy
            }
          */
            if (ViewPattern && id.match(ViewPattern)) {
              model.views = parseCanonicalViews(elt)
              recurse = false // elide canonical views package in package hierarcy
            } else {
              packages[id] = Object.assign(new PackageRecord(), {
                name: name,
                id: id,
                packages: parents,
                elements: []
              })
              if (parents.length) {
                if (id.match(/Pattern/)) {
                  recurse = false // don't record Pattern packages.
                } else {
                  packageHierarchy.add(parent, id)
                  packages[parent].elements.push({type: 'package', id: id})
                }
              }
              if (recurse && 'packagedElement' in elt) {
                // walk desendents
                elt.packagedElement.forEach(sub => {
                  visitPackage(sub, [id].concat(parents))
                })
              }
            }
            break
            // Pass through to get to nested goodies.
          case 'uml:Association':
            let from = elt.memberEnd.map(end => end.$['xmi:idref']).filter(id => id !== elt.ownedEnd[0].$['xmi:id'])[0]
            associations[id] = Object.assign(new AssociationRecord(id, name), {
              from: from,
              comments: parseComments(elt)
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

  function Class (id, name, properties) {
    return {
      id,
      name,
      properties
    }
  }

  function PropertyRecord (model, classId, id, name, idref, href, lower, upper, comments) {
    if (model === undefined) {
      return // short-cut for objectify
    }
    if (classId === null) {
      console.warn('no class name for PropertyRecord ' + id)
    }
    this.classId = classId
    this.id = id
    this.name = name
    this.idref = idref
    this.href = href
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
  function Property (id, name, type, min, max, association, aggregation) {
    return {id, name, type, min, max, association, aggregation}
  }

  function RefereeRecord     (classId, propName) {
    // if (classId === null) {
    //   throw Error('no class id for ReferenceRecord with property name ' + propName)
    // }
    this.classId = classId
    this.propName = propName
  }
  function ModelRecord       () { }
  function Model (source, packages) {
    return {
      source,
      packages: packages,
      get classes () { return ['bar', 'baz'] }
    }
  }
  function PackageRecord     () { }
  function Package (id, name, elements) {
    return {
      id,
      name,
      elements
    }
  }
  function EnumRecord        () { }
  function Enumeration (id, name, values) {
    return {
      id,
      name,
      values
    }
  }
  function DatatypeRecord    () { }
  function Datatype (id, name) {
    return {
      id,
      name
    }
  }
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

  function updateReferees (model) {
    // Find set of types for each property.
    Object.keys(model.properties).forEach(propName => {
      let p = model.properties[propName]
      p.uniformType = findMinimalTypes(model, p)
      p.sources.forEach(s => {
        let t = s.href || s.idref
        let referent =
            t in model.classes ? model.classes[t] :
            t in model.enums ? model.enums[t] :
            t in model.datatypes ? model.datatypes[t] :
            null
        if (referent) {
          referent.referees.push(new RefereeRecord(s.classId, propName))
        } else {
          // console.warn('referent not found: ' + referent)
        }
      }, [])
    }, [])
  }

  function getView (model, source, viewLabels, followReferencedClasses, followReferentHierarchy, nestInlinableStructure) {
    if (viewLabels.constructor !== Array) {
      viewLabels = [viewLabels]
    }

    let ret = Object.assign(new ModelRecord(), {
      source: Object.assign({}, source, { viewLabels }),
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
    updateReferees(ret)

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
        packages: old.packages.slice(),
        referees: []
      }
      addPackages(to, model, e.packages)
      ret.packages[old.packages[0]].elements.push({ type: 'enumeration', id: old.id })
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
        packages: old.packages.slice(),
        referees: []
      }
      addPackages(to, model, e.packages)
      ret.packages[old.packages[0]].elements.push({ type: 'datatype', id: old.id })
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
            isAbstract: old.isAbstract,
            referees: [],
            comments: []
          } // was deepCopy(old)
          ret.classes[classId] = c
          old.properties.forEach(
            p => {
              let id = p.idref || p.href
              if (id in model.enums) {
                copyEnum(ret, model, id)
              }
              if (id in model.datatypes) {
                copyDatatype(ret, model, id)
              }
              if (followReferencedClasses && id in model.classes) {
                dependentClassIds.push(id)
              }
              c.properties.push(new PropertyRecord(ret, c.id, p.id, p.name, p.idref, p.href, p.lower, p.upper))
            }
          )
          addPackages(ret, model, c.packages)
          ret.packages[old.packages[0]].elements.push({ type: 'class', id: old.id })
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
          elements: [],
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
      return classIds.indexOf(source.classId) !== -1
    }
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

  /** find the unique object types for a property
   */
  function findMinimalTypes (model, p) {
    return p.sources.reduce((acc, s) => {
      let t = s.href || s.idref
      if (acc.length > 0 && acc.indexOf(t) === -1) {
        // debugger;
        // a.find(i => b.indexOf(i) !== -1)
      }
      return acc.indexOf(t) === -1 ? acc.concat(t) : acc
    }, [])
  }

  function add (obj, key, value) {
    let toAdd = { }
    toAdd[key] = value
    return Object.assign(obj, toAdd)
  }

  /** convert parsed structure to have correct prototypes
   */
  function objectify (modelStruct) {
    return Object.assign(new ModelRecord(), {
      source: Object.assign({}, modelStruct.source),
      packages: Object.keys(modelStruct.packages).reduce(
        (acc, packageId) => add(acc, packageId, Object.assign(new PackageRecord(), modelStruct.packages[packageId])),
        {}
      ),
      classes: Object.keys(modelStruct.classes).reduce(
        (acc, classId) => add(acc, classId, Object.assign(new ClassRecord(), modelStruct.classes[classId], {
          properties: modelStruct.classes[classId].properties.map(
            prop => Object.assign(new PropertyRecord(), prop)
          )
        }, referees(modelStruct.classes[classId]))),
        {}
      ),
      properties: Object.keys(modelStruct.properties).reduce(
        (acc, propertyName) => add(acc, propertyName, Object.assign({}, modelStruct.properties[propertyName], {
          sources: modelStruct.properties[propertyName].sources.map(
            propertyRecord => Object.assign(new PropertyRecord(), propertyRecord)
          )
        })),
        {}
      ),
      enums: simpleCopy(modelStruct.enums, EnumRecord),
      datatypes: simpleCopy(modelStruct.datatypes, DatatypeRecord),
      classHierarchy: Object.assign({}, modelStruct.classHierarchy),
      packageHierarchy: Object.assign({}, modelStruct.packageHierarchy),
      associations: Object.keys(modelStruct.associations).reduce(
        (acc, associationId) => add(acc, associationId, Object.assign(new AssociationRecord(), modelStruct.associations[associationId])),
        {}
      ),
      views: modelStruct.views.map(
        view => Object.assign(new ViewRecord(), view)
      )
    })
    function simpleCopy (obj, f) {
      return Object.keys(obj).reduce(
        (acc, key) => add(acc, key, Object.assign(new f(), obj[key],
                                                  referees(obj[key]))),
        {}
      )
    }
    function referees (obj) {
      return {
        referees: obj.referees.map(
          prop => Object.assign(new RefereeRecord(), prop)
        )
      }
    }
  }

  return {
    parseJSON: function (jsonText, source, cb) {
      try {
        let model = objectify(JSON.parse(jsonText))
        model.source = source
        model.getView = getView
        cb(null, model)
      } catch (err) {
        cb(err)
      }
    },
    parseXMI: function (xmiText, source, cb) {
      require('xml2js').Parser().parseString(xmiText, function (err, document) {
        if (err) {
          cb(err)
        } else {
          let model = parseModel(document, source)
          model.getView = getView
          cb(null, model)
        }
      })
    },
    duplicateGraph: function (xmiGraph) {
      return objectify(JSON.parse(JSON.stringify(xmiGraph)))
    },
    toUML: function (xmiGraph) {
      let enums = {}
      let classes = {}
      let datatypes = {}
      let associations = {}

      return new Model(
        xmiGraph.source,
        Object.keys(xmiGraph.packageHierarchy.roots).map(createPackage)
      )

      function mapElementById (elt) {
        switch (elt.type) {
        case 'package':
          return createPackage(elt.id)
        case 'enumeration':
          return createEnumeration(elt.id)
        case 'datatype':
          return createDatatype(elt.id)
        case 'class':
          return createClass(elt.id)
        default:
          return elt
        }
      }

      function createPackage (packageId) {
        const packageRecord = xmiGraph.packages[packageId]
        return new Package(packageId, packageRecord.name, packageRecord.elements.map(mapElementById))
      }

      function createEnumeration (enumerationId) {
        if (enumerationId in enums) {
          return enums[enumerationId]
        }
        const enumerationRecord = xmiGraph.enums[enumerationId]
        return enums[enumerationId] = new Enumeration(enumerationId, enumerationRecord.name, enumerationRecord.values)
      }

      function createDatatype (datatypeId) {
        if (datatypeId in enums) {
          return enums[datatypeId]
        }
        const datatypeRecord = xmiGraph.datatypes[datatypeId]
        return enums[datatypeId] = new Datatype(datatypeId, datatypeRecord.name)
      }

      function createClass (classId) {
        if (classId in enums) {
          return enums[classId]
        }
        const classRecord = xmiGraph.classes[classId]
        return enums[classId] = new Class(classId, classRecord.name, classRecord.properties.map(createProperty))
      }

      function createProperty (propertyRecord) {
        return new Property(propertyRecord.id, propertyRecord.name, propertyRecord.idref, propertyRecord.min, propertyRecord.max, propertyRecord.association, propertyRecord.aggregation)
      }

    },
    ModelRecord: ModelRecord,
    PropertyRecord: PropertyRecord,
    ClassRecord: ClassRecord,
    PackageRecord: PackageRecord,
    EnumRecord: EnumRecord,
    DatatypeRecord: DatatypeRecord,
    ViewRecord: ViewRecord,
    AssociationRecord: AssociationRecord,
    AssocRefRecord: AssocRefRecord,
    RefereeRecord: RefereeRecord,
    Aggregation: { shared: AGGREGATION_shared, composite: AGGREGATION_composite }
  }
}

module.exports = CanonicalUmlXmiParser
