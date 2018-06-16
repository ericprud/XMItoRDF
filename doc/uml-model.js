/**
 */

function UmlModel ($) {

  if (typeof UmlModel.singleton === 'object')
    return UmlModel.singleton
  const AGGREGATION_shared = 'AGGREGATION_shared'
  const AGGREGATION_composite = 'AGGREGATION_composite'

  /** render members of a Model or a Package
   */
  function renderList (name, list, foo, cssClass) {
    let expandPackages = $('<img/>', { src: 'plusbox.gif' })
    let elements = $('<ul/>')
    let packages = $('<div/>').addClass(['uml', cssClass]).append(
      expandPackages,
      $('<span/>')
        .text(cssClass + ' ' + name + ' ' + list.length + ' element' + (list.length === 1 ? '' : 's'))
        .addClass('heading'),
      elements
    ).addClass(COLLAPSED).on('click', evt => {
      if (packages.hasClass(COLLAPSED)) {
        elements.append(list.map(
          elt => $('<li/>').append(/*elt.render()*/foo(elt))
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
        source,
        packages,
        missingElements,
        get classes () { return ['bar', 'baz'] }
      })
    }

    render () {
      let ret = $('<div/>').addClass('uml', 'model', EXPANDED)
      let sourceString = [this.source.resource, this.source.method, this.source.timestamp].join(' ')
      let packages = renderList(sourceString, this.packages, elt => elt.render(), 'model')
      ret.append(packages)
      return ret
    }


  }

  class Packagable {
    constructor (id, name) {
      Object.assign(this, {
        id,
        name
      })
    }

    render () {
      let ret = $('<div/>').addClass('uml', 'model', EXPANDED)
      ret.append('render() not implemented on: ' + Object.keys(this).join(' | '))
      return ret
    }
  }

  class Package extends Packagable {
    constructor (id, name, elements) {
      super(id, name)
      Object.assign(this, {
        elements
      })
    }

    render () {
      let ret = $('<div/>').addClass('uml', 'package', EXPANDED)
      let packages = renderList(this.name, this.elements, elt => elt.render(), 'package')
      ret.append(packages)
      return ret
    }
  }

  class Enumeration extends Packagable {
    constructor (id, name, values) {
      super(id, name)
      Object.assign(this, {
        values
      })
    }

    render () {
      let ret = $('<div/>').addClass('uml', 'enumeration', EXPANDED)
      let packages = renderList(this.name, this.values, elt => elt, 'enumeration')
      ret.append(packages)
      return ret
    }
  }

  class Datatype extends Packagable {
    constructor (id, name) {
      super(id, name)
      Object.assign(this, {
      })
    }
  }

  class Class extends Packagable {
    constructor (id, name, properties) {
      super(id, name)
      Object.assign(this, {
        properties
      })
    }
  }

  class Property {
    constructor (id, name, type, min, max, association, aggregation) {
      Object.assign(this, {
        id,
        name,
        type,
        min,
        max,
        association,
        aggregation
      })
    }
  }

  function AssociationRecord (id, name) {
    // if (name === null) {
    //   throw Error('no name for AssociationRecord ' + id)
    // }
    this.id = id
    this.name = name
  }

  class MissingElement {
    constructor (id) {
      Object.assign(this, {
        id
      })
    }
  }

  return UmlModel.singleton = {
    Model,
    Property,
    Class,
    Package,
    Enumeration,
    Datatype,
    MissingElement,
//    Association,
    Aggregation: { shared: AGGREGATION_shared, composite: AGGREGATION_composite }
  }
}

module.exports = UmlModel
