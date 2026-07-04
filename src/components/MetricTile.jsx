const MetricTile = ({ detail, label, tone = 'neutral', value }) => (
  <div className={`metric-tile ${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    {detail && <small>{detail}</small>}
  </div>
)

export default MetricTile
