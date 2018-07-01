/**
 */

function UmlModel (modelOptions = {}, $ = null) {

  if (!('externalDatatype' in modelOptions)) {
    modelOptions.externalDatatype = () => false
  }
  if (typeof UmlModel.singleton === 'object')
    return UmlModel.singleton
  const AGGREGATION_shared = 'AGGREGATION_shared'
  const AGGREGATION_composite = 'AGGREGATION_composite'

  /** render members of a Model or a Package
   */
  function renderElement (name, list, renderF, cssClass) {
    let expandPackages = $('<img/>', { src: 'plusbox.gif' })
    let elements = $('<ul/>')
    let packages = $('<div/>').addClass(['uml', cssClass]).append(
      expandPackages,
      $('<span/>').text(cssClass).addClass('type'),
      $('<span/>').text(name).addClass('name'),
      $('<span/>').text(list.length).addClass('length'),
      elements
    ).addClass(COLLAPSED).on('click', evt => {
      if (packages.hasClass(COLLAPSED)) {
        elements.append(list.map(
          elt => $('<li/>').append(renderF(elt))
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
    constructor (source, packages, missingElements) {
      Object.assign(this, {
        get type () { return 'Model' },
        source,
        packages,
        missingElements,
        // getClasses: function () {
        //   return packages.reduce(
        //     (acc, pkg) => acc.concat(pkg.list('Class')), []
        //   )
        // }
        get classes () {
          return this.packages.reduce(
            (acc, pkg) => acc.concat(pkg.list('Class')), []
          )
        },
        get enumerations () {
          return this.packages.reduce(
            (acc, pkg) => acc.concat(pkg.list('Enumeration')), []
          )
        },
        get datatypes () {
          return this.packages.reduce(
            (acc, pkg) => acc.concat(pkg.list('Datatype')), []
          )
        },
        get properties () {
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
      let ret = $('<div/>').addClass('uml', 'model', EXPANDED)
      let sourceString = [this.source.resource, this.source.method, this.source.timestamp].join(' ')
      let packages = renderElement(sourceString, this.packages, elt => elt.render(), 'model')
      ret.append(packages)
      return ret
    }

    toShExJ (options = {}) {
      return {
        "@context": "http://www.w3.org/ns/shex.jsonld",
        "type": "Schema",
        "shapes": this.packages.reduce(
          (acc, pkg) => acc.concat(pkg.toShExJ([], options)), []
        )
      }
    }
  }

  class Packagable {
    constructor (id, name, packages, comments) {
      Object.assign(this, {
        id,
        name
      })
      if (packages) { Object.assign(this, { packages }) }
      if (comments) { Object.assign(this, { comments }) }
    }

    render () {
      let ret = $('<div/>').addClass('uml', 'model', EXPANDED)
      ret.append('render() not implemented on: ' + Object.keys(this).join(' | '))
      return ret
    }
  }

  class Package extends Packagable {
    constructor (id, name, elements, packages, comments) {
      super(id, name, packages, comments)
      Object.assign(this, {
        get type () { return 'Package' },
        elements
      })
    }

    render () {
      let ret = $('<div/>').addClass('uml', 'package', EXPANDED)
      let packages = renderElement(this.name, this.elements, elt => elt.render(), 'package')
      ret.append(packages)
      return ret
    }

    list (type) {
      return this.elements.reduce(
        (acc, elt) => elt.type === type
          ? acc.concat([elt])
          : elt.type === 'Package'
          ? acc.concat(elt.list(type))
          : acc,
        []
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
    constructor (id, name, values, packages, comments) {
      super(id, name, packages, comments)
      Object.assign(this, {
        get type () { return 'Enumeration' },
        values
      })
    }

    render () {
      let ret = $('<div/>').addClass('uml', 'enumeration', EXPANDED)
      let packages = renderElement(this.name, this.values, elt => elt, 'enumeration')
      ret.append(packages)
      return ret
    }

    summarize () {
      return $('<span/>').addClass(['uml', 'enumeration']).append(
        $('<span/>').text('enumeration').addClass('type'),
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
    constructor (id, name, packages, comments) {
      super(id, name, packages, comments)
      Object.assign(this, {
        external: modelOptions.externalDatatype(name),
        get type () { return 'Datatype' }
      })
    }

    render () {
      return $('<div/>').addClass('uml', 'datatype', EXPANDED).append(
        renderElement(this.name, [], () => null, 'datatype')
      )
    }

    summarize () {
      return $('<span/>').addClass(['uml', 'datatype']).append(
        $('<span/>').text('datatype').addClass('type'),
        $('<span/>').text(this.name).addClass('name')
      )
    }

    toShExJ (parents = [], options = {}) {
      let ret = {
        "id": options.iri(this.name, this),
        "type": "NodeConstraint",
        "datatype": this.datatype
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

  class Class extends Packagable {
    constructor (id, name, generalizations, properties, isAbstract, packages, comments) {
      super(id, name, packages, comments)
      Object.assign(this, {
        get type () { return 'Class' },
        generalizations,
        properties,
        isAbstract
      })
    }

    render () {
      let ret = $('<div/>').addClass('uml', 'class', EXPANDED)
      let packages = renderElement(this.name, this.properties, property => {
        return property.renderProp()
      }, 'class')
      ret.append(packages)
      return ret
    }

    summarize () {
      let expandPackages = $('<img/>', { src: 'plusbox.gif' })
      let elements = $('<ul/>')
      let packages = $('<span/>').addClass(['uml', 'class', 'object']).append(
        expandPackages,
        $('<span/>').text('class').addClass('type'),
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
    constructor (id, name, type, min, max, association, aggregation, comments) {
      Object.assign(this, {
        get type () { return 'Property' },
        id,
        name,
        type,
        min,
        max,
        association,
        aggregation
      })
      if (comments && comments.length) { this.comments = comments }
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
    constructor (id, ref) {
      Object.assign(this, {
        get type () { return 'Import' },
        id, ref
      })
    }

    render () {
      let ret = $('<div/>').addClass('uml', 'import', EXPANDED)
      ret.append($('<div/>').addClass('leader').text('→'), this.ref.render())
      return ret
    }

    summarize () {
      return $('<span/>').addClass(['uml', 'import']).append(
        $('<span/>').text('import').addClass('type'),
        $('<span/>').append(this.ref.summarize()).addClass('name')
      )
    }

    toShExJ (parents = [], options = {}) {
      return []
    }
  }

  class Reference {
    constructor () {
      Object.assign(this, {
      })
    }
/*
    render () {
      let ret = $('<div/>').addClass('uml', 'model', EXPANDED)
      ret.append('render() not implemented on: ' + Object.keys(this).join(' | '))
      return ret
    }
*/
  }

  class ImportReference extends Reference {
    constructor (_import) {
      super()
      Object.assign(this, {
        get type () { return 'ImportReference' },
        _import
      })
    }
/*
    render () {
      let ret = $('<div/>').addClass('uml', 'package', EXPANDED)
      let packages = renderElement(this.name, this.elements, elt => elt.render(), 'package')
      ret.append(packages)
      return ret
    }

    list (type) {
      return this.elements.reduce(
        (acc, elt) => elt.type === type
          ? acc.concat([elt])
          : elt.type === 'ImportReference'
          ? acc.concat(elt.list(type))
          : acc,
        []
      )
    }

    toShExJ (parents = [], options = {}) {
      return this.elements.reduce(
        (acc, elt) => acc.concat(elt.toShExJ(parents.concat(this.name), options)),
        []
      )
    }
*/
  }

  class PropertyReference extends Reference {
    constructor (_class, property) {
      super()
      Object.assign(this, {
        get type () { return 'PropertyReference' },
        _class,
        property
      })
    }
/*
    render () {
      let ret = $('<div/>').addClass('uml', 'package', EXPANDED)
      let packages = renderElement(this.name, this.elements, elt => elt.render(), 'package')
      ret.append(packages)
      return ret
    }

    list (type) {
      return this.elements.reduce(
        (acc, elt) => elt.type === type
          ? acc.concat([elt])
          : elt.type === 'PropertyReference'
          ? acc.concat(elt.list(type))
          : acc,
        []
      )
    }

    toShExJ (parents = [], options = {}) {
      return this.elements.reduce(
        (acc, elt) => acc.concat(elt.toShExJ(parents.concat(this.name), options)),
        []
      )
    }
*/
  }


  class MissingElement {
    constructor (id, references = []) {
      Object.assign(this, {
        get type () { return 'MissingElement' },
        id,
        references
      })
    }

    summarize () {
      return $('<span/>').addClass(['uml', 'missing']).append(
        $('<span/>').text('missing').addClass('type'),
        $('<span/>').text(this.id).addClass('name')
      )
    }
  }

  return UmlModel.singleton = {
    Model,
    Property,
    Class,
    Package,
    Enumeration,
    Datatype,
    Import,
    Reference,
    ImportReference,
    PropertyReference,
    MissingElement,
//    Association,
    Aggregation: { shared: AGGREGATION_shared, composite: AGGREGATION_composite }
  }
}

module.exports = UmlModel
