import type { DemoEvent } from '@/lib/types';
import { formatOvers, requiredRate, runRate } from '@/lib/sports';

export function MatchCentre({ event }: { event: DemoEvent }) {
  const cricket = event.cricket;
  const current = cricket?.innings[(cricket.currentInnings ?? 0) - 1];
  return (
    <section
      aria-label="Match centre"
      className="match-centre space-y-4 rounded-lg border border-border bg-card p-4"
    >
      <h2 className="text-2xl font-[Georgia]">
        {cricket ? 'Cricket match centre' : 'Match centre'}
      </h2>
      <p className="text-xs text-faint">
        Simulated data · illustrative snapshots, never live scores.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {event.participants.map((team, index) => (
          <div key={team} className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-accent text-sm font-semibold"
            >
              {team
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium break-words">{team}</p>
              {event.score ? (
                <p className="text-2xl tabular-nums">{event.score.values[index]}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Fact label="Venue" value={event.venue ?? 'Not supplied'} />
        <Fact
          label="Scheduled start"
          value={
            event.scheduledAt
              ? `${new Date(event.scheduledAt).toISOString().replace('T', ' ').slice(0, 16)} UTC (simulated)`
              : 'Not supplied'
          }
        />
        {cricket ? (
          <>
            <Fact label="Format" value={cricket.format} />
            <Fact
              label="Current innings"
              value={cricket.currentInnings ? String(cricket.currentInnings) : 'Not started'}
            />
          </>
        ) : null}
      </dl>
      {event.score ? (
        <p className="text-sm">
          {event.score.label} · {event.score.detail}
        </p>
      ) : !cricket ? (
        <p className="text-sm text-faint">
          Score, clock and detailed statistics are not supplied for this fixture.
        </p>
      ) : null}
      {cricket ? (
        <>
          <div className="space-y-2">
            {cricket.innings.map((innings, index) => (
              <div
                key={index}
                className="flex flex-wrap justify-between gap-2 rounded-md bg-background p-3 text-sm"
              >
                <span>
                  Innings {index + 1} · {innings.team}
                </span>
                <strong className="tabular-nums">
                  {innings.runs}/{innings.wickets} ({formatOvers(innings.legalBalls)} overs)
                </strong>
              </div>
            ))}
          </div>
          {current ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Fact label="Legal deliveries" value={String(current.legalBalls)} />
              <Fact label="Current run rate" value={runRate(current.runs, current.legalBalls)} />
              <Fact
                label="Target"
                value={cricket.target ? String(cricket.target) : 'Not applicable'}
              />
              <Fact
                label="Required run rate"
                value={event.phase === 'completed' ? 'Match complete' : requiredRate(cricket)}
              />
            </dl>
          ) : (
            <p className="text-sm text-faint">No innings score available yet.</p>
          )}
          <p className="text-xs text-faint">
            Overs use legal deliveries: 19.5 means 19 overs and 5 balls. Run rates use runs per six
            legal balls.
          </p>
          <details open>
            <summary className="min-h-11 cursor-pointer content-center font-medium">
              Batting scorecard
            </summary>
            {current?.batting?.length ? (
              <div className="overflow-x-auto">
                <table className="scorecard">
                  <caption className="sr-only">Available simulated batting rows</caption>
                  <thead>
                    <tr>
                      {['Batter', 'R', 'B', '4s', '6s', 'Status'].map((text) => (
                        <th scope="col" key={text}>
                          {text}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.batting.map((row) => (
                      <tr key={row.name}>
                        <th scope="row">{row.name}</th>
                        <td>{row.runs}</td>
                        <td>{row.balls}</td>
                        <td>{row.fours}</td>
                        <td>{row.sixes}</td>
                        <td>{row.dismissal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-faint">
                  Available batters only; this is not a full innings scorecard.
                </p>
              </div>
            ) : (
              <p className="text-sm text-faint">Batting details not supplied.</p>
            )}
          </details>
          <details open>
            <summary className="min-h-11 cursor-pointer content-center font-medium">
              Bowling scorecard
            </summary>
            {current?.bowling?.length ? (
              <div className="overflow-x-auto">
                <table className="scorecard">
                  <caption className="sr-only">Available simulated bowling rows</caption>
                  <thead>
                    <tr>
                      {['Bowler', 'O', 'M', 'R', 'W', 'Econ'].map((text) => (
                        <th scope="col" key={text}>
                          {text}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.bowling.map((row) => (
                      <tr key={row.name}>
                        <th scope="row">{row.name}</th>
                        <td>{formatOvers(row.legalBalls)}</td>
                        <td>{row.maidens}</td>
                        <td>{row.runs}</td>
                        <td>{row.wickets}</td>
                        <td>{runRate(row.runs, row.legalBalls)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-faint">
                  Available bowlers only; figures do not represent the entire innings.
                </p>
              </div>
            ) : (
              <p className="text-sm text-faint">Bowling details not supplied.</p>
            )}
          </details>
        </>
      ) : null}
      {event.result ? (
        <p className="rounded-md bg-accent p-3 text-sm font-medium">{event.result}</p>
      ) : null}
    </section>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}
