package com.theo.flow;

import org.json.JSONArray;
import org.junit.Test;
import java.time.LocalDate;
import java.util.List;
import static org.junit.Assert.*;

public class WeekLanesTest {
    // Week of Mon 2026-10-05.
    static final LocalDate WEEK=LocalDate.of(2026,10,5);
    static List<CalendarData.Event> events() throws Exception {
        return CalendarData.parse(new JSONArray("["
            + "{\"id\":\"long\",\"type\":\"todo\",\"title\":\"긴 일정\",\"start_date\":\"2026-10-02\",\"due_date\":\"2026-10-12\"},"
            + "{\"id\":\"a\",\"type\":\"task\",\"title\":\"월화\",\"start_date\":\"2026-10-05\",\"due_date\":\"2026-10-06\"},"
            + "{\"id\":\"b\",\"type\":\"task\",\"title\":\"목\",\"start_date\":\"2026-10-08\"},"
            + "{\"id\":\"c\",\"type\":\"task\",\"title\":\"화수\",\"start_date\":\"2026-10-06\",\"due_date\":\"2026-10-07\"},"
            + "{\"id\":\"d\",\"type\":\"task\",\"title\":\"다음 주\",\"start_date\":\"2026-10-14\"}]"));
    }
    static WeekLanes.Bar bar(WeekLanes lanes,String id){
        for(WeekLanes.Bar bar:lanes.bars)if(bar.event.id.equals(id))return bar;
        return null;
    }

    @Test public void itemsThatDoNotOverlapShareALane() throws Exception {
        WeekLanes lanes=WeekLanes.layout(events(),WEEK,5);
        assertNull("Only items touching the week are laid out",bar(lanes,"d"));
        assertEquals(0,bar(lanes,"long").lane);                 // longest first, from Monday to Sunday
        assertEquals(7,bar(lanes,"long").span);
        assertEquals(1,bar(lanes,"a").lane);                    // Mon-Tue
        assertEquals(2,bar(lanes,"c").lane);                    // Tue-Wed overlaps a, so it drops a lane
        assertEquals(1,bar(lanes,"b").lane);                    // Thu fits beside a in lane 1
        assertFalse(lanes.anyHidden());
    }
    @Test public void whatDoesNotFitIsCountedPerDay() throws Exception {
        WeekLanes lanes=WeekLanes.layout(events(),WEEK,2);
        assertNull(bar(lanes,"c"));
        assertEquals(1,lanes.hidden[1]);
        assertEquals(1,lanes.hidden[2]);
        assertEquals(0,lanes.hidden[0]);
        assertEquals(0,lanes.hidden[3]);
        assertTrue(lanes.anyHidden());
    }
    @Test public void aMultiDayItemKeepsOnlyItsDaysInsideTheWeek() throws Exception {
        WeekLanes.Bar tail=bar(WeekLanes.layout(events(),LocalDate.of(2026,10,12),5),"long");
        assertEquals(0,tail.col);
        assertEquals(1,tail.span);                               // only Monday the 12th is left of it
    }
}
