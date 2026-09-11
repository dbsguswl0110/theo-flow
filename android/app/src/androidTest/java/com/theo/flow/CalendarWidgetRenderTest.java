package com.theo.flow;

import android.appwidget.AppWidgetHostView;
import android.appwidget.AppWidgetProviderInfo;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import android.widget.RemoteViews;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONArray;
import java.time.LocalDate;
import java.io.File;
import java.io.FileOutputStream;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class CalendarWidgetRenderTest {
    static JSONArray fixture() throws Exception {
        return new JSONArray("[{\"id\":\"1\",\"type\":\"todo\",\"title\":\"월간 보고서\",\"start_date\":\"2026-09-09\",\"due_date\":\"2026-09-12\"},{\"id\":\"2\",\"type\":\"task\",\"title\":\"회의\",\"start_date\":\"2026-09-10\"},{\"id\":\"3\",\"type\":\"task\",\"title\":\"다음 주 준비\",\"start_date\":\"2026-09-13\",\"due_date\":\"2026-09-15\"}]");
    }
    @Test public void remoteViewsInflatesRendersAndReappliesAtFoldSizes() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        JSONArray data=fixture();
        for(int[] size:new int[][]{{320,480},{680,400},{220,300}}){
            final int width=size[0],height=size[1];
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{
                AppWidgetHostView host=new AppWidgetHostView(context);
                AppWidgetProviderInfo info=new AppWidgetProviderInfo();
                info.provider=new android.content.ComponentName(context,TheoCalendarWidgetProvider.class);
                host.setAppWidget(1,info);host.setPadding(0,0,0,0);
                RemoteViews remote=TheoCalendarWidgetProvider.frame(context,1,width,height,LocalDate.of(2026,9,10),data,false,2);
                host.updateAppWidget(remote);
                int w=Math.round(width*context.getResources().getDisplayMetrics().density);
                int h=Math.round(height*context.getResources().getDisplayMetrics().density);
                host.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));
                host.layout(0,0,w,h);
                assertNotNull("RemoteViews must inflate successfully",host.findViewById(R.id.calendar_image));
                Bitmap before=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);host.draw(new Canvas(before));
                host.updateAppWidget(remote);
                host.measure(View.MeasureSpec.makeMeasureSpec(w,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(h,View.MeasureSpec.EXACTLY));
                host.layout(0,0,w,h);
                Bitmap after=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);host.draw(new Canvas(after));
                assertTrue("App return / reapply must not enlarge calendar",before.sameAs(after));
                File dir=new File(context.getExternalFilesDir(null),"widget-review");dir.mkdirs();
                try(FileOutputStream out=new FileOutputStream(new File(dir,"widget-"+width+"x"+height+".png"))){
                    after.compress(Bitmap.CompressFormat.PNG,100,out);
                }catch(Exception e){throw new AssertionError(e);}
            });
        }
    }
    @Test public void tasksDotsAndDurationLinesAreActuallyDrawn() throws Exception {
        java.util.List<CalendarData.Event> data=CalendarData.parse(fixture());
        Bitmap result=CalendarPainter.draw(680,400,LocalDate.of(2026,9,10),data,false);
        Bitmap empty=CalendarPainter.draw(680,400,LocalDate.of(2026,9,10),java.util.Collections.emptyList(),false);
        assertFalse("Events must change calendar pixels",result.sameAs(empty));
        int changed=0;
        for(int y=140;y<780;y++)for(int x=24;x<1336;x++)if(result.getPixel(x,y)!=empty.getPixel(x,y))changed++;
        assertTrue("Titles and markers visible below weekday header",changed>200);
        // Sep 9-12 period: second week, columns 2..5, first lane, line y=153.
        int ink=result.getPixel(700,306);
        assertEquals(153,android.graphics.Color.red(ink));
        assertEquals(104,android.graphics.Color.green(ink));
    }
}
