// Widget extension entry point. Bundles the home-screen widget and the
// print-order Live Activity.
import SwiftUI
import WidgetKit

@main
struct MyBookLabWidgetsBundle: WidgetBundle {
    var body: some Widget {
        LatestBookWidget()
        PrintOrderLiveActivity()
    }
}
