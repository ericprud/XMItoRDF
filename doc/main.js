function main () {
  const TOGGLE_TIME = 50 // time in μsec to toggle collapsed lists.
  const RENDER_DELAY = 10 // time to pause for display (horrible heuristics). .css('opacity', .99)

  function docURL (term) {
    return 'http://lion.ddialliance.org/ddiobjects/' +
      term.toLowerCase() + '#parent_properties'
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
      // makeHierarchy.test()
      let classHierarchy = makeHierarchy()
      let classes = {}
      let properties = {}
      let owlm = []
      let shexc = [
        'PREFIX ddi: <http://ddi-alliance.org/ns/#>\n' +
          'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n' +
          'PREFIX umld: <http://schema.omg.org/spec/UML/2.1/uml.xml#>\n' +
          'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n'
      ]
      let index = {}
      // let realized = makeHierarchy()
      let XMIParser = require('../node_modules/jhipster-uml/lib/editors/canonical_parser.js')
      let root = getRootElement(xmiText)
      let parsedData = XMIParser.parse({
        root: root,
        databaseTypes: {
          contains: function (type) { return true },
          getName: () => 'general'
        }
      })
      // parsedData.root = root
      parsedData.myClasses = classes
      parsedData.myProperties = properties
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
            triples: triples,
            classHierarchy: classHierarchy,
            index: index,
            parsedData: parsedData})

          status.text('rendering structure...')
          window.setTimeout(delay.render, RENDER_DELAY)

          function indexXML (elt, parents) {
            let parent = parents[parents.length - 1]
            let type = elt.$['xmi:type']
            let recurse = true
            if ('xmi:id' in elt.$) {
              let id = elt.$['xmi:id']
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
                  if (id in classes) {
                    throw Error('already seen class id ' + id)
                  }
                  classes[id] = {
                    properties: [],
                    realizes: [],
                    others: []
                  }
                  // record class hierarchy
                  if ('generalization' in elt) {
                    classHierarchy.add(elt.generalization[0].$.general, id) // elt.$['xmi:id']
                  }
                  break
                case 'uml:Property':
                  if (elt.$.name === parent) {
                    if (triple[2] === 'realizes') {
                      classes[parent].realizes.push(elt.type[0].$['xmi:idref'])
                    } else {
                      classes[parent].others.push(triple[2])
                    }
                  } else if (!('name' in elt.$)) {
                    throw Error('expected name in ' + JSON.stringify(elt.$) + ' in ' + parent)
                  } else if (elt.$.name.charAt(0).match(/[A-Z]/)) {
                    throw Error('unexpected property name ' + elt.$.name + ' in ' + parent)
                  } else {
                    classes[parent].properties.push(id)
                    if (!(elt.$.name in properties)) {
                      properties[elt.$.name] = {sources: []}
                    }
                    properties[elt.$.name].sources.push({
                      in: parent,
                      id: id,
                      typeRef: elt.type[0].$['xmi:idref'],
                      type: elt.type[0].$['href'],
                      min: 'value' in elt.lowerValue[0].$ ? elt.lowerValue[0].$.value : 0,
                      max: 'value' in elt.upperValue[0].$ ? elt.upperValue[0].$.value : 99
                    })
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
                case 'uml:Model':
                case 'uml:Package':
                case 'uml:Enumeration':
                case 'uml:DataType':
                  break
                default:
                  console.log('need handler for ' + type)
              }

              if (recurse) {
                // walk desendents
                let skipTheseElements = ['lowerValue', 'upperValue', 'generalization']
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
          reusedProperties(parsedData, diagnostics)
          polymorphicProperties(properties, diagnostics)
          console.dir({owlm: owlm, shexc: shexc})
          puns(parsedData, diagnostics)
          addTriples(triples, diagnostics)
          collapse(diagnostics)

          div.append($('<ul/>').append(
            $('<li/>').text('structure').append(structure),
            $('<li/>').text('diagnostics').append(diagnostics),
            $('<li/>').append(
              $('<a/>', {href: ''}).text('OWL').on('click', () => download(shexc.join('\n\n'), 'text/plain', 'ddi.omn'))
            ),
            $('<li/>').append(
              $('<a/>', {href: ''}).text('ShEx').on('click', () => download(shexc.join('\n\n'), 'text/shex', 'ddi.shex'))
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

      function reusedProperties (object, into) {
        // Object.keys(object.classes).reduce((acc, klass) => {
        //   return acc.concat(object.classes[klass].fields.map(field => {
        //     let a = field.split(/_/)
        //     return a[a.length-1]
        //   }))
        // }, [])
        const x = Object.keys(object.classes).reduce((acc, klass) => {
          object.classes[klass].fields.forEach(
            field => {
              let a = field.split(/_/)
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
              (l, r) => x.seen[r].length - x.seen[l].length
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
          propName => properties[propName].uniformType.length !== 1
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
                    $('<a/>', { href: docURL(lookIn) }).text(lookIn)
                  ))
                ))
            })
          )))
        owlm = owlm.concat(Object.keys(properties).filter(propName => !(propName in x)).map(
          propName => 'ObjectProperty ddi:' + propName + ': range dd:' + properties[propName].uniformType[0]
        ))
        owlm = owlm.concat(Object.keys(classes).map(
          className => 'Class ddi:' + className + ' SubClassOf\n' +
            classes[className].properties.map(
              propId => {
                let elt = propId
                let propName = index[elt].element.$.name
                return '    ddi:' + propName + ' only ' + pname(properties[propName].uniformType[0])
              }
            ).join('\n  and\n')
        ))
        shexc = shexc.concat(Object.keys(classes).map(
          className => 'ddi:' + className + ' {\n' +
            classes[className].properties.map(
              propId => {
                let elt = propId
                let propName = index[elt].element.$.name
                let refChar = properties[propName].sources[0].type === undefined ? '@' : ''
                let card = shexCardinality(index[elt].element)
                return '  ddi:' + propName + ' ' + refChar + pname(properties[propName].uniformType[0]) + ' ' + card
              }
            ).join(';\n') + '\n} // rdfs:definedBy <' + docURL(className) + '>'
        ))
      }

      function shexCardinality (elt) {
        let lower = 'value' in elt.lowerValue[0].$ ? parseInt(elt.lowerValue[0].$.value) : 0
        let upper = 'value' in elt.upperValue[0].$ ? parseInt(elt.upperValue[0].$.value) : -1
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
          {url: 'http://schema.omg.org/spec/UML/2.1/uml.xml#', prefix: 'umld:'}
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
}

window.onload = main
