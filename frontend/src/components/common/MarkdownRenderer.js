import React from 'react';

const MarkdownRenderer = ({ content }) => {
  const renderLine = (line, index) => {
    // Headers
    if (line.startsWith('### ')) {
      return <h3 key={index} style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{line.slice(4)}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={index} style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{line.slice(3)}</h2>;
    }
    if (line.startsWith('# ')) {
      return <h1 key={index} style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '1.5rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>{line.slice(2)}</h1>;
    }

    // Bullet points
    if (line.match(/^[-*]\s/)) {
      const text = processInlineFormatting(line.slice(2));
      return (
        <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', paddingLeft: '0.5rem' }}>
          <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>•</span>
          <span>{text}</span>
        </div>
      );
    }

    // Numbered lists
    if (line.match(/^\d+\.\s/)) {
      const match = line.match(/^(\d+)\.\s(.+)/);
      if (match) {
        const text = processInlineFormatting(match[2]);
        return (
          <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', paddingLeft: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)', flexShrink: 0, fontWeight: 600 }}>{match[1]}.</span>
            <span>{text}</span>
          </div>
        );
      }
    }

    // Empty lines
    if (line.trim() === '') {
      return <div key={index} style={{ height: '0.5rem' }} />;
    }

    // Regular paragraphs
    const text = processInlineFormatting(line);
    return <p key={index} style={{ marginBottom: '0.5rem', lineHeight: 1.6 }}>{text}</p>;
  };

  const processInlineFormatting = (text) => {
    const parts = [];
    let key = 0;

    // Process bold (**text**)
    const boldRegex = /\*\*(.+?)\*\*/g;
    let match;
    let lastIndex = 0;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
      }
      parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : text;
  };

  const lines = content.split('\n');
  
  return (
    <div style={{ fontSize: '0.8rem', lineHeight: '1.6', color: 'var(--text-primary)' }}>
      {lines.map((line, index) => renderLine(line, index))}
    </div>
  );
};

export default MarkdownRenderer;
