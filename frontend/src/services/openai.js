// OpenAI Service for generating reports
export const generateReport = async (sessionName, alerts) => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey || !apiKey.trim()) {
    throw new Error('OpenAI API key not configured. Please set REACT_APP_OPENAI_API_KEY environment variable.');
  }

  // Prepare alert summary for the prompt
  const alertSummary = alerts.map(a => ({
    time: new Date(a.timestamp).toLocaleTimeString(),
    zone: a.zoneName || 'System',
    severity: a.severity,
    message: a.message
  }));

  const severityCounts = alerts.reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {});

  const prompt = `You are an AI assistant analyzing drone surveillance data for crowd safety monitoring.

Session Name: ${sessionName}
Total Alerts: ${alerts.length}
Severity Breakdown:
- Critical: ${severityCounts.critical || 0}
- High: ${severityCounts.high || 0}
- Medium: ${severityCounts.medium || 0}
- Low: ${severityCounts.low || 0}

Alert Details:
${JSON.stringify(alertSummary, null, 2)}

Please generate a comprehensive, professional report analyzing this drone surveillance session. Include:
1. Executive Summary (2-3 sentences)
2. Key Findings and Patterns  
3. Critical Incidents (if any)
4. Recommendations for Future Operations
5. Overall Safety Assessment

Format the report in clear sections with markdown formatting. Keep it concise but thorough.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in crowd safety analysis and security operations. Generate clear, actionable reports.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate report');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    throw new Error(`OpenAI API Error: ${error.message}`);
  }
};

// Streaming version for real-time report generation
export const generateReportStreaming = async (sessionName, alerts, onChunk) => {
  console.log('[OpenAI Service] Starting streaming request');
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey || !apiKey.trim()) {
    console.error('[OpenAI Service] API key not configured');
    throw new Error('OpenAI API key not configured. Please set REACT_APP_OPENAI_API_KEY environment variable.');
  }

  console.log('[OpenAI Service] API key found, length:', apiKey.length);

  // Prepare alert summary for the prompt
  const alertSummary = alerts.map(a => ({
    time: new Date(a.timestamp).toLocaleTimeString(),
    zone: a.zoneName || 'System',
    severity: a.severity,
    message: a.message
  }));

  const severityCounts = alerts.reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {});

  const prompt = `You are an AI assistant analyzing drone surveillance data for crowd safety monitoring.

Session Name: ${sessionName}
Total Alerts: ${alerts.length}
Severity Breakdown:
- Critical: ${severityCounts.critical || 0}
- High: ${severityCounts.high || 0}
- Medium: ${severityCounts.medium || 0}
- Low: ${severityCounts.low || 0}

Alert Details:
${JSON.stringify(alertSummary, null, 2)}

Please generate a comprehensive, professional report analyzing this drone surveillance session. Include:
1. Executive Summary (2-3 sentences)
2. Key Findings and Patterns  
3. Critical Incidents (if any)
4. Recommendations for Future Operations
5. Overall Safety Assessment

Format the report in clear sections with markdown formatting. Keep it concise but thorough.`;

  try {
    console.log('[OpenAI Service] Making fetch request to OpenAI API');
    console.log('[OpenAI Service] Session name:', sessionName);
    console.log('[OpenAI Service] Alert count:', alerts.length);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in crowd safety analysis and security operations. Generate clear, actionable reports.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        stream: true
      })
    });

    console.log('[OpenAI Service] Response status:', response.status);

    if (!response.ok) {
      console.error('[OpenAI Service] Response not OK');
      const error = await response.json();
      console.error('[OpenAI Service] Error details:', error);
      throw new Error(error.error?.message || 'Failed to generate report');
    }

    console.log('[OpenAI Service] Starting to read stream');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[OpenAI Service] Stream completed, total chunks:', chunkCount);
        break;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('[OpenAI Service] Received [DONE] signal');
            continue;
          }

          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content;
            if (content) {
              chunkCount++;
              onChunk(content);
            }
          } catch (e) {
            // Skip invalid JSON
            console.debug('[OpenAI Service] Skipped invalid JSON in line');
          }
        }
      }
    }
  } catch (error) {
    console.error('[OpenAI Service] Error in streaming:', error);
    throw new Error(`OpenAI API Error: ${error.message}`);
  }
};
