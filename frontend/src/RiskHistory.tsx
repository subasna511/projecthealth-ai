
import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock
} from 'lucide-react';

type HistoryRecord = {
  recorded_date: string;
  health_score: number;
  risk_level: string;
  ml_prediction: string | null;
  ml_confidence: number | null;
  completion_percentage: number;
};

type Props = {
  projectId: string;
};

export default function RiskHistory({ projectId }: Props) {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          `/api/history/${projectId}`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          throw new Error('Unable to load risk history');
        }

        const data: HistoryRecord[] = await response.json();

        if (active) {
          setHistory(data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load history'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      active = false;
    };
  }, [projectId]);

  const first = history[0];
  const latest = history[history.length - 1];

  const change =
    first && latest
      ? latest.health_score - first.health_score
      : 0;

  const trend =
    history.length < 2
      ? 'Not enough history'
      : change > 0
      ? 'Improving'
      : change < 0
      ? 'Declining'
      : 'Stable';

  // Chart dimensions
  const width = 400;
  const height = 190;
  const left = 35;
  const right = 15;
  const top = 15;
  const bottom = 30;

  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  function getX(index: number) {
    return left + (
      history.length <= 1
        ? chartWidth / 2
        : (index / (history.length - 1)) * chartWidth
    );
  }

  function getY(score: number) {
    return top + chartHeight * (1 - score / 100);
  }

  const points = history
    .map((record, index) => (
      `${getX(index)},${getY(record.health_score)}`
    ))
    .join(' ');

  return (
    <div className="risk-recommendations">
      <h4>
        <Clock size={17} /> Project Risk History
      </h4>

      {loading ? (
        <p>Loading history...</p>
      ) : error ? (
        <p className="helper-text">{error}</p>
      ) : history.length === 0 ? (
        <p className="helper-text">
          No historical assessments recorded yet.
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block'
            }}
            role="img"
            aria-label="Project health score history graph"
          >
            {[0, 25, 50, 75, 100].map(value => (
              <g key={value}>
                <line
                  x1={left}
                  y1={getY(value)}
                  x2={width - right}
                  y2={getY(value)}
                  stroke="#cbd5e1"
                  strokeDasharray="3 4"
                />
                <text
                  x={left - 7}
                  y={getY(value) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="currentColor"
                >
                  {value}
                </text>
              </g>
            ))}

            <polyline
              points={points}
              fill="none"
              stroke="#2563eb"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {history.map((record, index) => (
              <circle
                key={record.recorded_date}
                cx={getX(index)}
                cy={getY(record.health_score)}
                r="4"
                fill="#2563eb"
                stroke="white"
                strokeWidth="1.5"
              >
                <title>
                  {record.recorded_date}:
                  {' '}{record.health_score}/100
                </title>
              </circle>
            ))}

            {first && (
              <text
                x={getX(0)}
                y={height - 7}
                textAnchor={
                  history.length === 1 ? 'middle' : 'start'
                }
                fontSize="11"
                fill="currentColor"
              >
                {first.recorded_date.slice(5)}
              </text>
            )}

            {history.length > 1 && latest && (
              <text
                x={getX(history.length - 1)}
                y={height - 7}
                textAnchor="end"
                fontSize="11"
                fill="currentColor"
              >
                {latest.recorded_date.slice(5)}
              </text>
            )}
          </svg>

          <p>
            Latest Health Score:{' '}
            <strong>{latest.health_score}/100</strong>
          </p>

          <p>
            Trend:{' '}
            <strong>
              {trend === 'Improving' && (
                <TrendingUp size={16} color="green" />
              )}
              {trend === 'Declining' && (
                <TrendingDown size={16} color="red" />
              )}
              {trend === 'Stable' && (
                <Minus size={16} />
              )}
              {' '}{trend}
            </strong>
          </p>

          <p>
            Recorded assessments:{' '}
            <strong>{history.length}</strong>
          </p>

          {history.length > 1 && (
            <p>
              Health score change:{' '}
              <strong>
                {change > 0 ? '+' : ''}
                {change} points
              </strong>
            </p>
          )}

          <p className="helper-text">
            One assessment is retained per project per day.
            Trends are based on recorded health scores.
          </p>
        </>
      )}
    </div>
  );
}
