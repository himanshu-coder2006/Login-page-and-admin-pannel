const StatusBanner = ({ status }) => {
  if (!status?.text) {
    return null
  }

  return <p className={`status-banner ${status.type}`}>{status.text}</p>
}

export default StatusBanner
