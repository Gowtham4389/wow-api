import EmptyState from '../common/EmptyState.jsx';

/**
 * Placeholder for grouped requests. Saved requests already carry everything a
 * collection needs, so this becomes a grouping layer over the same store.
 */
export function CollectionsPanel() {
  return (
    <EmptyState
      icon="folder"
      title="Collections are coming"
      description="Saved requests will be groupable into collections with shared environment variables such as {{baseUrl}}."
    />
  );
}

export default CollectionsPanel;
