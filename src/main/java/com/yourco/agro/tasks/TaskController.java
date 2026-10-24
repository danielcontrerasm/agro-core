package com.yourco.agro.tasks;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/tasks")
public class TaskController {
  private final TaskService tasks;

  public TaskController(TaskService tasks) { this.tasks = tasks; }

  @GetMapping
  public List<TaskDtos.Task> list(@RequestParam(required = false) Long farmId) { return tasks.list(farmId); }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public TaskDtos.Task create(@Valid @RequestBody TaskDtos.CreateRequest request) { return tasks.create(request); }

  @PatchMapping("/{id}")
  public TaskDtos.Task update(@PathVariable Long id, @Valid @RequestBody TaskDtos.UpdateRequest request) {
    return tasks.update(id, request);
  }
}
