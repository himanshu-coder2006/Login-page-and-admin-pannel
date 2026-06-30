const MetricTile = ({ label, value }) => (
  <div className="metric-tile">
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
)

export default MetricTile
