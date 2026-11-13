package com.i27dark.nvmdark;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalAIPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
