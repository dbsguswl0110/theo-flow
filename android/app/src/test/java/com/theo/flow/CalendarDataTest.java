package com.theo.flow;
import org.junit.Test;
import org.json.JSONArray;
import java.time.LocalDate;
import java.time.YearMonth;
import static org.junit.Assert.*;

public class CalendarDataTest {
    @Test public void sixWeeksStartMondayIncludingLeapYear(){
        assertEquals(LocalDate.parse("2026-08-31"),CalendarData.first(YearMonth.of(2026,9)));
        assertEquals(LocalDate.parse("2024-01-29"),CalendarData.first(YearMonth.of(2024,2)));
    }
    @Test public void matchesAppParentChildCompletedAndTrashSemantics() throws Exception {
        JSONArray data=new JSONArray("[{\"id\":\"p\",\"type\":\"todo\",\"title\":\"Project\",\"start_date\":\"2026-09-10\",\"due_date\":\"2026-09-12\",\"subTodos\":[{\"id\":\"c\",\"title\":\"Child\",\"completed\":1}]},{\"type\":\"note\",\"startDate\":\"2026-09-10\"},{\"type\":\"task\",\"startDate\":\"2026-09-10\",\"deletedAt\":\"2026-09-11\"}]");
        java.util.List<CalendarData.Event> events=CalendarData.parse(data);
        assertEquals(2,events.size());
        CalendarData.Event child=events.stream().filter(e->e.id.equals("c")).findFirst().get();
        assertEquals(LocalDate.parse("2026-09-10"),child.start);assertTrue(child.completed);
        assertEquals(2,CalendarData.week(events,LocalDate.parse("2026-09-07")).size());
        assertEquals(0,CalendarData.week(events,LocalDate.parse("2026-09-14")).size());
    }
}
