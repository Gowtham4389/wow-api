import Icon from './Icon.jsx';

export function EmptyState({ icon = 'info', title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Icon name={icon} size={20} />
      </div>
      {title && <p className="empty-state__title">{title}</p>}
      {description && <p className="empty-state__text">{description}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
