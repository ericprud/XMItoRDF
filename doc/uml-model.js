/** UML Model
 * editing features:

 * @function{detach}: replace  all references to <this> with a reference to a new MissingElement.

 * @function{remove(X)}: delete <X>'s entry in <this>.

 * - update(X, Y): replace all uses of <X> in <this> with <Y>.
 *
 * rendering bugs:
 *   1. junky HTML -- mixes BLOCK and FLOW
 *   2. doesn't display multi-generaltional inheritance
 */

function UmlModel (modelOptions = {}, $ = null) {

  if (!('externalDatatype' in modelOptions)) {
    modelOptions.externalDatatype = () => false
  }
  if (typeof UmlModel.singleton === 'object')
    return UmlModel.singleton
  const AGGREGATION_shared = 'AGGREGATION_shared'
  const AGGREGATION_composite = 'AGGREGATION_composite'
  const XSD = 'http://www.w3.org/2001/XMLSchema#'

  /** render members of a Model or a Package
   */
  function renderElement (renderTitle, list, renderMember, cssClass) {
    let expandPackages = $('<img/>', { src: 'plusbox.gif' })
    let elements = $('<ul/>')
    let packages = $('<div/>').addClass('uml ' + cssClass).append(
      expandPackages,
      $('<span/>').text(cssClass).addClass('type', cssClass),
      renderTitle(this),
      $('<span/>').text(list.length).addClass('length'),
      elements
    ).addClass(COLLAPSED).on('click', evt => {
      if (packages.hasClass(COLLAPSED)) {
        elements.append(list.map(
          elt => {
            try {
              return $('<li/>').append(renderMember(elt))
            } catch (e) {
              console.warn([e, elt])
              return $('<li/>').addClass('error').append(e)
            }
          }
        ))
        packages.removeClass(COLLAPSED).addClass(EXPANDED)
        expandPackages.attr('src', 'minusbox.gif')
      } else {
        elements.empty()
        packages.removeClass(EXPANDED).addClass(COLLAPSED)
        expandPackages.attr('src', 'plusbox.gif')
      }
      return false
    })
    return packages
  }

  const COLLAPSED = 'collapsed', EXPANDED = 'expanded'

  class Model {
    constructor (source, elements, missingElements) {
      Object.assign(this, {
        get type () { return 'Model' },
        source,
        elements,
        missingElements,
        // getClasses: function () {
        //   return elements.reduce(
        //     (acc, pkg) => acc.concat(pkg.list('Class')), []
        //   )
        // }
        getClasses: function () {
          return this.elements.reduce(
            (acc, pkg) => acc.concat(pkg.list('Class')), []
          )
        },
        getEnumerations: function () {
          return this.elements.reduce(
            (acc, pkg) => acc.concat(pkg.list('Enumeration')), []
          )
        },
        getDatatypes: function () {
          return this.elements.reduce(
            (acc, pkg) => acc.concat(pkg.list('Datatype')), []
          )
        },
        getProperties: function () {
          let cz = this.classes
          let ret = {}
          cz.forEach(
            klass => {
              klass.properties.forEach(
                property => {
                  if (!(property.name in ret)) {
                    ret[property.name] = { uses: [] }
                  }
                  ret[property.name].uses.push({ klass, property })
                }
              )
            }
          )
          return ret
        }
      })
    }

    render () {
      let ret = $('<div/>').addClass('uml model ' + EXPANDED)
      let sourceString = [this.source.resource, this.source.method, this.source.timestamp].join(' ')
      let renderTitle = _ => [
        $('<span/>').text(this.source.resource).addClass('name'),
        ' ',
        this.source.method,
        ' ',
        this.source.timestamp
      ]
      let packages = renderElement(renderTitle, this.elements, elt => elt.render(), 'model')
      ret.append(packages)
      return ret
    }

    toShExJ (options = {}) {
      return {
        "@context": "http://www.w3.org/ns/shex.jsonld",
        "type": "Schema",
        "shapes": this.elements.reduce(
          (acc, pkg) => acc.concat(pkg.toShExJ([], options)), []
        )
      }
    }
  }

  class Packagable {
    constructor (id, references, name, parent, comments) {
      Object.assign(this, {
        id,
        references,
        name
      })
      if (parent) { Object.assign(this, { parent }) }
      if (comments) { Object.assign(this, { comments }) }
    }

    remove (missingElements) {
      let from = this.references.find(ref => ref instanceof Package || ref instanceof Model) // parent.elements
      let fromIndex = from ? from.elements.indexOf(this) : -1
      if (fromIndex === -1) {
        // throw Error('detach package: ' + this.id + ' not found in parent ' + from.id)
      } else {
        from.elements.slice(fromIndex, 1)
      }
      let refIndex = from ? this.references.indexOf(from) : -1
      if (refIndex === -1) {
        // throw Error('detach package: ' + this.id + ' has no reference to parent ' + from.id)
      } else {
        this.references.slice(refIndex, 1)
      }
      this.detach(missingElements)
    }

    detach (missingElements) {
      if (this.references.length === 0) {
        // no refs so no MissingElemennt
        return
      }
      if (this.id in missingElements) {
        throw Error(this.type() + ' ' + this.id + ' already listed in missingElements')
      }
      let missingElt = new MissingElement(this.id, this.references)
      missingElements[this.id] = missingElt
      this.references.forEach(
        ref => ref.update(this, missingElt)
      )
      if (this.references.length === 0) {
        delete missingElements[this.id]
      }
    }

    render () {
      let ret = $('<div/>').addClass('uml model ' + EXPANDED)
      ret.append('render() not implemented on: ' + Object.keys(this).join(' | '))
      return ret
    }

    renderTitle () {
      return $('<span/>').text(this.name).addClass('name')
    }
  }

  class Package extends Packagable {
    constructor (id, reference, name, elements, parent, comments) {
      // pass the same falsy reference value to Packagable
      super(id, reference ? [reference] : reference, name, parent, comments)
      Object.assign(this, {
        get type () { return 'Package' },
        elements
      })
    }

    remove (missingElements/*, type*/) {
      this.elements.forEach(
        doomed => {
          let idx = doomed.references.indexOf(this)
          if (idx === -1) {
            // throw Error('detach package: ' + this.id + ' not found in references of child ' + doomed.id)
          } else {
            doomed.references.splice(idx, 1) // detach package from references
          }
          doomed.remove(missingElements)
        }
      )
      super.remove(missingElements)
      /*
      let doomed = this.list(type)
      console.log('detach', doomed)
      this.list(type).forEach(
        doomed => doomed.detach(missingElements)
      )
       */
    }

    render () {
      let ret = $('<div/>').addClass('uml package ' + EXPANDED)
      let packages = renderElement(_ => this.renderTitle(), this.elements, elt => elt.render(), 'package')
      ret.append(packages)
      return ret
    }

    update (from, to) {
      let idx = this.elements.indexOf(from)
      if (idx === -1) {
        throw Error('update package: ' + from.id + ' not found in elements')
      }
      this.elements[idx] = to
    }

    list (type) {
      return this.elements.reduce(
        (acc, elt) => {
          let add = []
          if (!type || elt.type === type) {
            add = add.concat([elt])
          }
          if (elt.type === 'Package') {
            add = add.concat(elt.list(type))
          }
          return acc.concat(add)
        }, []
      )
    }

    toShExJ (parents = [], options = {}) {
      return this.elements.reduce(
        (acc, elt) => acc.concat(elt.toShExJ(parents.concat(this.name), options)),
        []
      )
    }

  }

  class Enumeration extends Packagable {
    constructor (id, references, name, values, parent, comments) {
      super(id, references, name, parent, comments)
      Object.assign(this, {
        get type () { return 'Enumeration' },
        values
      })
    }

    render () {
      let ret = $('<div/>').addClass('uml enumeration ' + EXPANDED)
      let packages = renderElement(_ => this.renderTitle(), this.values, elt => elt, 'enumeration')
      ret.append(packages)
      return ret
    }

    summarize () {
      return $('<span/>').addClass('uml enumeration').append(
        $('<span/>').text('enumeration').addClass('type enumeration'),
        $('<span/>').text(this.name).addClass('name'),
        $('<span/>').text(this.values.length).addClass('length')
      )
    }

    toShExJ (parents = [], options = {}) {
      let ret = {
        "id": options.iri(this.name, this),
        "type": "NodeConstraint",
        "values": this.values.map(
          v => options.iri(v, this)
        )
      }
      if (options.annotations) {
        let toAdd = options.annotations(this)
        if (toAdd && toAdd.length) {
          ret.annotations = toAdd
        }
      }
      return ret
    }
  }

  class Datatype extends Packagable {
    // Parent may be null for automatic datatypes generated by e.g. XSD hrefs.
    constructor (id, references, name, parent, comments) {
      super(id, references, name, parent, comments)
      Object.assign(this, {
        external: modelOptions.externalDatatype(name),
        get type () { return 'Datatype' }
      })
    }

    render () {
      return $('<div/>').addClass('uml datatype ' + EXPANDED).append(
        renderElement(_ => this.renderTitle(), [], () => null, 'datatype')
      )
    }

    summarize () {
      return $('<span/>').addClass('uml datatype').append(
        $('<span/>').text('datatype').addClass('type datatype'),
        $('<span/>').text(this.name).addClass('name')
      )
    }

    toShExJ (parents = [], options = {}) {
      let ret = {
        "id": options.iri(this.name, this),
        "type": "NodeConstraint"
      }
      // Calling program encouraged to add xmlDatatype attributes.
      if (this.xmlDatatype) {
        ret.datatype = this.xmlDatatype
      } else {
        ret.nodeKind = 'Literal'
      }
      // Should they also add facets?
      if (options.annotations) {
        let toAdd = options.annotations(this)
        if (toAdd && toAdd.length) {
          ret.annotations = toAdd
        }
      }
      return ret
    }
  }

  class Class extends Packagable {
    constructor (id, references, name, generalizations, properties, isAbstract, parent, comments) {
      super(id, references, name, parent, comments)
      Object.assign(this, {
        get type () { return 'Class' },
        generalizations,
        properties,
        isAbstract
      })
    }


    remove (missingElements) {
      this.properties.forEach(
        prop => prop.remove(missingElements)
      )
      super.remove(missingElements)
    }

    render () {
      let ret = $('<div/>').addClass('uml class ' + EXPANDED)
      let renderTitle = _ => [
        $('<span/>').text(this.name).addClass('name')
      ].concat((this.generalizations || []).reduce(
        (acc, gen) => acc.concat([' ⊃', gen.summarize()]), []
      ))
      let packages = renderElement(renderTitle, this.properties, property => {
        return property.renderProp()
      }, 'class')
      ret.append(packages)
      return ret
    }

    summarize () {
      let expandPackages = $('<img/>', { src: 'plusbox.gif' })
      let elements = $('<ul/>')
      let packages = $('<span/>').addClass('uml class object').append(
        expandPackages,
        $('<span/>').text('class').addClass('type class'),
        $('<span/>').text(this.name).addClass('name'),
        $('<span/>').text(this.properties.length).addClass('length'),
        elements
      ).addClass(COLLAPSED).on('click', evt => {
        if (packages.hasClass(COLLAPSED)) {
          elements.append(this.properties.map(
            elt => $('<li/>').append(elt.renderProp())
          ))
          packages.removeClass(COLLAPSED).addClass(EXPANDED)
          expandPackages.attr('src', 'minusbox.gif')
        } else {
          elements.empty()
          packages.removeClass(EXPANDED).addClass(COLLAPSED)
          expandPackages.attr('src', 'plusbox.gif')
        }
        return false
      })
      return packages
    }

    toShExJ (parents = [], options = {}) {
      let shape = {
        "type": "Shape"
      }
      if ('generalizations' in this && this.generalizations.length > 0) {
        shape.extends = this.generalizations.map(options.iri)
      }
      let ret = {
        "id": options.iri(this.name, this),
        "type": "ShapeDecl",
        "isAbstract": this.isAbstract,
        "shapeExpr": shape
      }
      if (this.properties.length > 0) {
        let conjuncts = this.properties.map(
          p => p.propToShExJ(options)
        )
        if (conjuncts.length === 1) {
          shape.expression = conjuncts[0]
        } else {
          shape.expression = {
            "type": "EachOf",
            "expressions": conjuncts
          }
        }
      }
      if (options.annotations) {
        let toAdd = options.annotations(this)
        if (toAdd && toAdd.length) {
          shape.annotations = toAdd
        }
      }
      return ret
    }
  }

  class Property {
    constructor (id, inClass, name, type, min, max, association, aggregation, comments) {
      Object.assign(this, {
        get type () { return 'Property' },
        id,
        inClass,
        name,
        type,
        min,
        max,
        association,
        aggregation
      })
      if (comments && comments.length) { this.comments = comments }
    }

    update (from, to) {
      if (this.type !== from) {
        throw Error('update property: ' + from.id + ' not property type')
      }
      this.type = to
    }

    remove (missingElements) {
      let idx = this.type.references.indexOf(this)
      if (idx === -1) {
        throw Error('property type ' + this.type.id + ' does not list ' + this.id + ' in references')
      }
      this.type.references.splice(idx, 1) // detach prop from references.
    }

    renderProp () {
      return $('<span/>').append(
        this.name,
        this.type.summarize()
      )
    }

    propToShExJ (options) {
      let valueExpr =
            this.type.type === 'Datatype' && this.type.external === true
            ? {
                "type": "NodeConstraint",
                "datatype": this.type.name
              }
            : options.iri(this.type.name, this)
      let ret = {
        "type": "TripleConstraint",
        "predicate": options.iri(this.name, this),
        "valueExpr": valueExpr
      }
      if (this.min !== undefined) { ret.min = this.min }
      if (this.max !== undefined) { ret.max = this.max }
      if (options.annotations) {
        let toAdd = options.annotations(this)
        if (toAdd && toAdd.length) {
          ret.annotations = toAdd
        }
      }
      return ret
    }
  }

  class Import {
    constructor (id, target, reference) {
      Object.assign(this, {
        get type () { return 'Import' },
        id, target, reference
      })
    }

    toShExJ (parents = [], options = {}) {
      return []
    }

    render () {
      let ret = $('<div/>').addClass('uml model ' + EXPANDED)
      ret.append(
        $('<span/>').text('import').addClass('type import'),
        '→',
        this.target.render())
      return ret
    }

  }

  class MissingElement {
    constructor (id, references = []) {
      Object.assign(this, {
        get type () { return 'MissingElement' },
        id,
        references
      })
    }

    render () {
      return $('<span/>').addClass('uml missing').append(
        '☣',
        $('<span/>').text('missing').addClass('type missing'),
        $('<span/>').text(this.id).addClass('name')
      )
    }

    summarize () {
      return $('<span/>').addClass('uml missing').append(
        $('<span/>').text('missing').addClass('type missing'),
        $('<span/>').text(this.id).addClass('name')
      )
    }

    toShExJ (parents = [], options = {}) {
      console.warn('toShExJ: no definition for ' + this.id + ' referenced by ' + this.references.map(
        ref => ref.id
      ).join(', '))
      return []
    }
  }

  function fromJSON (obj) {
    let packages = {}
    let enums = {}
    let classes = {}
    let datatypes = {}
    let associations = {}
    let imports = {}
    let missingElements = {}

    let ret = new UmlModel.Model(
      xmiGraph.source,
      null,
      missingElements
    )
    ret.elements = Object.keys(xmiGraph.packageHierarchy.roots).map(
      packageId => createPackage(packageId, ret)
    )
    return ret

    function mapElementByXmiReference (xmiRef, reference) {
      switch (xmiRef.type) {
        case 'import':
          return followImport(xmiRef.id, reference)
        case 'package':
          return createPackage(xmiRef.id, reference)
        case 'enumeration':
          return createEnumeration(xmiRef.id, reference)
        case 'datatype':
          return createDatatype(xmiRef.id, reference)
        case 'class':
          return createClass(xmiRef.id, reference)
        default:
          throw Error('mapElementByXmiReference: unknown reference type in ' + JSON.stringify(xmiRef))
      }
    }

    function followImport (importId, reference) {
      if (importId in imports) {
        throw Error('import id "' + importId + '" already used for ' + JSON.stringify(imports[importId]))
        // imports[importId].references.push(reference)
        // return imports[importId]
      }
      const importRecord = xmiGraph.imports[importId]
      // let ref = createdReferencedValueType(importRecord.idref)
      // let ret = imports[importId] = new UmlModel.Import(importId, ref)
      let ret = imports[importId] = new UmlModel.Import(importId, null, reference)
      ret.target = createdReferencedValueType(importRecord.idref, ret)
      return ret
      // imports[importId] = createdReferencedValueType(importRecord.idref)
      // imports[importId].importId = importId // write down that it's an import for round-tripping
      // return imports[importId]
    }

    function createdReferencedValueType (target, reference) {
      if (target in xmiGraph.packages) {
        return createPackage(target, reference)
      }
      if (target in xmiGraph.enums) {
        return createEnumeration(target, reference)
      }
      if (target in xmiGraph.datatypes) {
        return createDatatype(target, reference)
      }
      if (target in xmiGraph.classes) {
        return createClass(target, reference)
      }
      return missingElements[target] = createMissingElement(target, reference)
    }

    function mapElementByIdref (propertyRecord, reference) {
      if (propertyRecord.href) {
        if (propertyRecord.href in datatypes) {
          datatypes[propertyRecord.href].references.push(reference)
          return datatypes[propertyRecord.href]
        }
        return datatypes[propertyRecord.href] = new UmlModel.Datatype(propertyRecord.href, [reference], propertyRecord.href, null, propertyRecord.comments)
      }
      return createdReferencedValueType(propertyRecord.idref, reference)
    }

    function createPackage (packageId, reference) {
      if (packageId in packages) {
        throw Error('package id "' + packageId + '" already used for ' + JSON.stringify(packages[packageId]))
      }
      const packageRecord = xmiGraph.packages[packageId]
      let ret = packages[packageId] = new UmlModel.Package(packageId, reference, packageRecord.name, null, reference, packageRecord.comments)
      ret.elements = packageRecord.elements.map(
        xmiReference => mapElementByXmiReference(xmiReference, ret)
      )
      return ret
    }

    function createEnumeration (enumerationId, reference) {
      if (enumerationId in enums) {
        enums[enumerationId].references.push(reference)
        return enums[enumerationId]
      }
      const enumerationRecord = xmiGraph.enums[enumerationId]
      return enums[enumerationId] = new UmlModel.Enumeration(enumerationId, [reference], enumerationRecord.name, enumerationRecord.values, reference, enumerationRecord.comments)
    }

    function createDatatype (datatypeId, reference) {
      if (datatypeId in datatypes) {
        datatypes[datatypeId].references.push(reference)
        return datatypes[datatypeId]
      }
      const datatypeRecord = xmiGraph.datatypes[datatypeId]
      return datatypes[datatypeId] = new UmlModel.Datatype(datatypeId, [reference], datatypeRecord.name, reference, datatypeRecord.comments)
    }

    function createClass (classId, reference) {
      if (classId in classes) {
        classes[classId].references.push(reference)
        return classes[classId]
      }
      const classRecord = xmiGraph.classes[classId]
      let ret = classes[classId] = new UmlModel.Class(classId, [reference], classRecord.name, classRecord.superClasses, [], classRecord.isAbstract, reference, classRecord.comments)
      // avoid cycles like Identifiable { basedOn Identifiable }
      ret.properties = classRecord.properties.map(
        propertyRecord => createProperty(propertyRecord, ret))
      return ret
    }

    function createMissingElement (missingElementId, reference) {
      if (missingElementId in missingElements) {
        missingElements[missingElementId].references.push(reference)
        return missingElements[missingElementId]
      }
      return missingElements[missingElementId] = new UmlModel.MissingElement(missingElementId, [reference])
    }

    function createProperty (propertyRecord, inClass) {
      let ret = new UmlModel.Property(propertyRecord.id, inClass, propertyRecord.name,
                                      null, // so we can pass the Property to unresolved types
                                      propertyRecord.min, propertyRecord.max,
                                      propertyRecord.association,
                                      propertyRecord.aggregation,
                                      propertyRecord.comments)
      ret.type = mapElementByIdref(propertyRecord, ret)
      return ret
    }

  }

  class Point {
    constructor (x, y) {
      Object.assign(this, {x, y})
    }
    foo () { return 'foo' }
    bar () { return 'bar' }
  }

  return UmlModel.singleton = {
    Model,
    Property,
    Class,
    Package,
    Enumeration,
    Datatype,
    Import,
    MissingElement,
//    Association,
    Aggregation: { shared: AGGREGATION_shared, composite: AGGREGATION_composite },
    fromJSON,
    Point
  }
}

module.exports = UmlModel
