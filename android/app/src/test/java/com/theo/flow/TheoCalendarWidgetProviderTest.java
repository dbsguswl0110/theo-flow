package com.theo.flow;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class TheoCalendarWidgetProviderTest {
    @Test public void trashAndCompletedItemsAreExcluded() throws Exception {
        assertFalse(TheoCalendarWidgetProvider.active(new JSONObject("{\"deleted_at\":\"2026-09-09\"}")));
        assertFalse(TheoCalendarWidgetProvider.active(new JSONObject("{\"deletedAt\":\"2026-09-09\"}")));
        assertFalse(TheoCalendarWidgetProvider.active(new JSONObject("{\"completed\":1}")));
        assertFalse(TheoCalendarWidgetProvider.active(new JSONObject("{\"completed\":true}")));
        assertTrue(TheoCalendarWidgetProvider.active(new JSONObject("{\"deleted_at\":null,\"completed\":0}")));
    }
    @Test public void serverDatesAndChildrenAreNormalised() throws Exception {
        JSONArray input=new JSONArray("[{\"id\":\"a\",\"type\":\"todo\",\"title\":\"Project\",\"start_date\":\"2026-09-09\",\"due_date\":\"2026-09-12\",\"subTodos\":[{\"id\":\"b\",\"title\":\"Child\"}]},{\"type\":\"note\",\"start_date\":\"2026-09-09\"}]");
        java.util.List<TheoCalendarWidgetProvider.Event> events=TheoCalendarWidgetProvider.events(input);
        assertEquals(2,events.size());
        assertEquals("2026-09-09",events.get(0).start);
        assertEquals("2026-09-12",events.get(0).end);
        assertTrue(events.get(0).duration);
        assertEquals("2026-09-09",events.get(1).start);
        assertFalse(events.get(1).duration);
    }
}
