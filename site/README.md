## Status

The current schema was derived directly from the names of classes and property in DDI-4 UML.
We are starting on bindings to some popular RDF vocabularies like DCAT and schema.org.
We hope that these bindings with work with the UML-derived schema, i.e. that the models will have the same associativity between entities.

## Model Manipulation
* eliminate *realizes* properties.
* eliminate all classes and enumerations nested in packages ending in "Pattern".
* map DDI-specific primitive datatypes to XSD datatypes.

## Nesting

The UML model captures a graph topology as a set of labeled classes, each with a list of properties.
Some classes are used for only one property in one class.
In ShEx, these can be defined as in-line shapes; ShEx renderers can represent those where they are used.
For instance, in DDI/UML, a `ConceptSystemIndicator` is used only for the `ConceptSystem`'s *contains* property.
In ShEx, this would look like (see [in situ single reference](https://github.com/ericprud/XMItoRDF/blob/modular/site/DDI_4-DR0.2.shex#L2209-L2210)):
```
ddi:ConceptSystem CLOSED EXTENDS ddi:AnnotatedIdentifiable {
  ...
  ddi:contains @ddi:ConceptIndicator *
  ...
}
```
With nesting, single-reference shapes like `ddi:ConceptIndicator` can be expressed inline a la (see [in situ nested reference](https://github.com/ericprud/XMItoRDF/blob/modular/site/DDI_4-DR0.2-nested.shex#L909-L914)):
```
ddi:ConceptSystem CLOSED EXTENDS ddi:AnnotatedIdentifiable {
  ...
  ddi:contains CLOSED {
    ddi:index xsd:integer *
    // shexmi:comment """Index value of member in an ordered array""";
    ddi:member @ddi:Concept *
    // shexmi:comment """Restricts member target class to Concept or subtype of Concept""";
  } *
  ...
}
```
The [build script](https://github.com/ericprud/XMItoRDF/blob/modular/site/ddiPSM#L163) maintains a [list of nestable shapes](https://github.com/ericprud/XMItoRDF/blob/modular/site/DDI_4-DR0.2-nested.list#L102-L105).

