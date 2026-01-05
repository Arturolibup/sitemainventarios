<?php

namespace App\Http\Controllers\Product;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class EntryProductController extends Controller
{
    public function __construct()
{
  $this->middleware('auth:api');
  $this->middleware('permission:products.view')->only(['show']);
}
}
