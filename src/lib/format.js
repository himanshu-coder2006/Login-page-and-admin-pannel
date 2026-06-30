export const formatDate = (dateValue) => {
  if (!dateValue) {
    return 'Never'
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateValue))
}
