// Measured axes: u runs along the roof, v rear-to-front, h is model y.
// These locate existing geometry; they never create missing connections.
export function fromPlant(u, v, h) {
  return [(u + v) / Math.SQRT2, h, (v - u) / Math.SQRT2];
}
export const FLOW_STEPS = [
  { title: 'Fresh Outdoor Air', zone: 0, focus: fromPlant(29,-21.7,12.4), span: 16,
    identification: { equipment: ['ahu'], anchors: ['upper-unit-1', 'upper-unit-2'] },
    description: 'Fresh outdoor air enters the system to replace the used indoor air. Recovered energy helps bring it closer to the temperature needed indoors.',
    detail: 'Blue highlights follow the green intake hoods and the supply units.' },
  { title: 'Return Air', zone: 1, focus: fromPlant(24,-21.3,4.6), span: 40, frameFill: 1,
    identification: { equipment: [], anchors: [] },
    description: 'Used indoor air is carried through ducts from the building to the rooftop AHU, bringing heating or cooling energy that can be recovered.',
    detail: 'Orange highlights follow the yellow duct branches into each extract unit.' },
  { title: 'Energy Recovery', zone: 2, focus: fromPlant(29,-19.8,10.6), span: 15, frameFill: 1,
    // Recovery circuits serve the AHUs; room-equipment is only selected in step 3.
    identification: { equipment: ['ahu'], anchors: ['left-equipment', 'right-equipment'] },
    description: 'The warmth or coolness is transferred to the incoming fresh air without mixing the two air streams.',
    detail: 'Cyan highlights show energy on the actual pipe circuits. Air stays in separate ducts.' },
  { title: 'Heat Pump', zone: 3, focus: fromPlant(31.3,-19.4,4.45), span: 8.5, viewDirection: [1,0.85,1],
    identification: { equipment: ['heat-pump'], anchors: ['central-structure', 'heat-pump-2'] },
    description: 'When recovered energy is not enough, the heat pump provides the additional heating or cooling needed to reach the desired temperature.',
    detail: 'The connected pipe cluster is shown. Energy highlights do not indicate water-flow direction.' },
  { title: 'Supply Air', zone: 0, focus: fromPlant(29,-18.9,12), span: 17,
    identification: { equipment: ['ahu'], anchors: ['upper-unit-1', 'upper-unit-2'] },
    description: 'The conditioned fresh air is delivered throughout the building to maintain a comfortable indoor environment.',
    detail: 'Blue highlights follow both supply branches into the magenta header and its downward outlet.' },
  // A higher, slightly oblique view clears the enclosure in front of the right
  // discharge hood; vapor still respects solid equipment and walls.
  { title: 'Exhaust', zone: 1, focus: fromPlant(18,-22.2,4.8), span: 51, viewDirection: [1,2.2,0],
    identification: { equipment: ['ahu'], anchors: ['left-equipment', 'right-equipment'] },
    description: 'After its energy has been recovered, the remaining exhaust air is safely discharged outdoors.',
    detail: 'Orange highlights reach the brown discharge hoods at the ends of both extract units.' },
];
export const FLOW_NETWORKS = {
  supply: { seeds: [fromPlant(29,-15.7,10.85)] },
  'extract-left': { seeds: [fromPlant(-4.45,-22.15,4.71)] },
  'extract-right': { seeds: [fromPlant(38.5,-22.15,4.71)] },
  'upper-cyan': { seeds: [fromPlant(26.485,-19.336,12.51),fromPlant(31.521,-19.336,12.51)] },
  'upper-light-blue': { seeds: [fromPlant(26.485,-19.125,12.17),fromPlant(31.521,-19.125,12.17)] },
  'upper-light-green': { seeds: [fromPlant(26.485,-19.731,12.5),fromPlant(31.521,-19.731,12.5)] },
  'upper-orange': { seeds: [fromPlant(26.485,-19.552,12.17),fromPlant(31.521,-19.552,12.17)] },
  'lower-cyan': { seeds: [fromPlant(30.819,-18.249,5.41)] },
  'lower-light-blue': { seeds: [fromPlant(30.962,-18.249,5.41)] },
  'lower-light-green': { seeds: [fromPlant(31.094,-18.249,5.41)] },
  'lower-orange': { seeds: [fromPlant(31.246,-18.249,5.41)] },
  'lower-dark-green': { seeds: [fromPlant(34.235,-20.16,3.3)] },
  'lower-red': { seeds: [fromPlant(29.738,-20.282,3.655),fromPlant(30.945,-20.282,3.655)] },
  'lower-dark-blue': { seeds: [fromPlant(29.559,-20.282,3.187),fromPlant(30.768,-20.282,3.187)] },
  'room-equipment': { seeds: [fromPlant(29.65,-20.2,3.65),fromPlant(30.86,-20.2,3.65),fromPlant(33.55,-20.2,3.3)] },
};
