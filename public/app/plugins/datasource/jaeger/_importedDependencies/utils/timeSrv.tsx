import { dateMath, dateTime, DateTime, getDefaultTimeRange, isDateTime, TimeRange, TimeZone } from '@grafana/data';

interface TimeModel {
  fiscalYearStartMonth?: number;
  getTimezone(): TimeZone;
}

export class TimeSrv {
  getTimeRange = (time: { from: DateTime | string; to: DateTime | string }, timeModel?: TimeModel): TimeRange => {
    // make copies if they are moment  (do not want to return out internal moment, because they are mutable!)
    const raw = {
      from: isDateTime(time.from) ? dateTime(time.from) : time.from,
      to: isDateTime(time.to) ? dateTime(time.to) : time.to,
    };

    const timezone = timeModel ? timeModel.getTimezone() : undefined;

    return {
      from: dateMath.parse(raw.from, false, timezone, timeModel?.fiscalYearStartMonth)!,
      to: dateMath.parse(raw.to, true, timezone, timeModel?.fiscalYearStartMonth)!,
      raw: raw,
    };
  };

  timeRange = (): TimeRange => {
    // Scenes would need the following code:
    // ```
    // if (window.__grafanaSceneContext && window.__grafanaSceneContext.isActive) {
    //   return sceneGraph.getTimeRange(window.__grafanaSceneContext).state.value;
    // }
    // ```
    // Since we do not use scenes in Jaeger, we ignore this and remove the dependency with `@grafana/scenes`.

    const time = getDefaultTimeRange().raw;
    const timeModel = undefined;
    return this.getTimeRange(time, timeModel);
  };
}

export const getTimeSrv = () => {
  return new TimeSrv();
};