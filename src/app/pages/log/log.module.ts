import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";

import { LogPage } from "./log";
import { LogPageRoutingModule } from "./log-routing.module";
import { LogItemModal } from "./logitem.modal";
import { LogItemComponent } from "./logitem.component";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    LogPageRoutingModule,
  ],
  declarations: [LogPage, LogItemModal, LogItemComponent],
  entryComponents: [LogItemModal, LogItemComponent],
})
export class LogModule {}
