package com.theo.flow;

import org.json.JSONArray;
import org.junit.Test;
import java.time.LocalDate;
import java.util.List;
import static org.junit.Assert.*;

public class CalendarTextTest {
    static List<CalendarData.Event> events() throws Exception {
        return CalendarData.parse(new JSONArray("["
            + "{\"id\":\"a\",\"type\":\"todo\",\"title\":\"월간 보고서\",\"start_date\":\"2026-09-09\",\"due_date\":\"2026-09-12\"},"
            + "{\"id\":\"b\",\"type\":\"task\",\"title\":\"회의\",\"start_date\":\"2026-09-10\"},"
            + "{\"id\":\"c\",\"type\":\"task\",\"title\":\"다음 주\",\"start_date\":\"2026-09-14\",\"due_date\":\"2026-09-15\"},"
            + "{\"id\":\"d\",\"type\":\"task\",\"title\":\"끝낸 일\",\"start_date\":\"2026-09-10\",\"completed\":1},"
            + "{\"id\":\"e\",\"type\":\"task\",\"title\":\"지난 일\",\"start_date\":\"2026-09-01\"}]"));
    }

    @Test public void tasksAndTodosAreToldApart() throws Exception {
        for(CalendarData.Event event:events())assertEquals(event.id.equals("a"),!event.task);
    }
    @Test public void foldedAndOpenedWidgetsPickTheirLayout() {
        assertFalse(CalendarText.isWide(320,480));
        assertFalse(CalendarText.isWide(280,300));
        assertTrue(CalendarText.isWide(680,400));
        assertTrue(CalendarText.isWide(720,720));
        assertFalse("A tall, narrow widget stays a plain month",CalendarText.isWide(540,700));
    }
    @Test public void agendaListsOpenItemsFromTodayOnSoonestFirst() throws Exception {
        LocalDate today=LocalDate.of(2026,9,10);
        List<CalendarData.Event> list=CalendarText.upcoming(events(),today,10);
        assertEquals(3,list.size());
        // Under way since the 9th counts as today; among today's items the one that ends first comes first.
        assertEquals("b",list.get(0).id);
        assertEquals("a",list.get(1).id);
        assertEquals("c",list.get(2).id);
        assertEquals(2,CalendarText.upcoming(events(),today,2).size());
    }
    @Test public void datesReadNaturally() throws Exception {
        LocalDate today=LocalDate.of(2026,9,10);
        List<CalendarData.Event> list=CalendarText.upcoming(events(),today,10);
        assertEquals("오늘",CalendarText.when(list.get(0),today));
        assertEquals("진행 중 → 9/12",CalendarText.when(list.get(1),today));
        assertEquals("9월 14일 (월) → 9/15",CalendarText.when(list.get(2),today));
        LocalDate eve=LocalDate.of(2026,9,13);
        assertEquals("내일 → 9/15",CalendarText.when(CalendarText.upcoming(events(),eve,10).get(0),eve));
    }
    @Test public void screenReaderGetsTodaysItems() throws Exception {
        String text=CalendarText.describe(LocalDate.of(2026,9,10),events());
        assertTrue(text,text.contains("2026년 9월 10일 목요일"));
        assertTrue(text,text.contains("오늘 일정 2개: 월간 보고서, 회의"));
        assertTrue(CalendarText.describe(LocalDate.of(2026,9,20),events()).contains("남은 일정이 없어요"));
    }
}
